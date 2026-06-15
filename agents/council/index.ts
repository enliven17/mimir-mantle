/**
 * Mimir Council Worker (Mantle / local-key signers)
 *
 * Boots a single Node process that runs up to 10 AI personas as autonomous
 * economic actors on Mantle. Every cycle:
 *
 *   1. Reads claimCount + each open/active claim from the contract.
 *   2. Builds a per-cycle evidence cache so all personas share 1 HTTP
 *      fetch per resolution URL.
 *   3. For each (claim, persona) pair, runs the decision pipeline:
 *        - Specialists skip out-of-category claims (no LLM call)
 *        - Rule-based personas evaluate from pool state (no LLM call)
 *        - LLM personas call the configured model with a persona prompt prefix
 *   4. Submits challengeClaim through the persona's own local EVM key when the
 *      decision says stake. Stakes are native MNT.
 *
 * Rate-limit strategy:
 *   - Personas are processed sequentially within a cycle (not in parallel).
 *   - The persona-runner throttles LLM calls (COUNCIL_LLM_THROTTLE_MS).
 *   - Rule-based + category-filtered personas don't consume LLM budget.
 *
 * Run: npm run council  (or via "npm run workers" / "npm run start:all")
 * Env: COUNCIL_<SLUG>_PRIVATE_KEY + _ADDRESS for each persona,
 *      NEXT_PUBLIC_CONTRACT_ADDRESS,
 *      GEMINI_API_KEY (preferred) OR ANTHROPIC_API_KEY,
 *      COUNCIL_GEMINI_API_KEY (optional — separate key/quota for the council),
 *      COUNCIL_PERSONAS_ACTIVE (optional CSV of slugs to restrict the roster).
 */

// Worker-scoped LLM key. Falls back to the shared GEMINI_API_KEY when
// COUNCIL_GEMINI_API_KEY is not set — gives the council its own rate-limit
// bucket separate from the oracle + market-creator.
{
  const k = process.env.COUNCIL_GEMINI_API_KEY?.trim();
  if (k) {
    process.env.GEMINI_API_KEY = k;
    // Isolate the council's rate-limit bucket: drop the shared rotation keys so
    // the council process uses ONLY its dedicated key, never the oracle/creator
    // pool. (lib/llm round-robins across GEMINI_API_KEY + GEMINI_API_KEY_2..4.)
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GEMINI_API_KEY_3;
    delete process.env.GEMINI_API_KEY_4;
  }
}

import {
  createMantlePublicClient,
  mantleChain,
  getContractAddress,
  weiToMnt,
} from "../../lib/mantle";
import { MIMIR_ABI, STATE } from "../../lib/mimir-abi";
import { activeLLMProvider, activeLLMModel } from "../../lib/llm";
import {
  COUNCIL_PERSONAS,
  personaAddressEnv,
  personaPrivateKeyEnv,
} from "./personas";
import { runPersonaForClaim } from "./shared/persona-runner";
import type {
  ClaimOnChain,
  PersonaRunnerContext,
  EvidenceCacheEntry,
} from "./shared/types";

const POLL_INTERVAL_MS = Number(process.env.COUNCIL_POLL_INTERVAL_MS ?? 180_000);
/**
 * Per-cycle work cap to stay under LLM free-tier rate limits.
 * Claims are sorted by deadline-proximity so the council focuses on
 * the markets closest to settling.
 */
const MAX_CLAIMS_PER_CYCLE = Number(process.env.COUNCIL_MAX_CLAIMS ?? 12);
const CONTRACT_ADDRESS     = getContractAddress();
const publicClient         = createMantlePublicClient();

// ── Env guard ─────────────────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
  console.error("GEMINI_API_KEY or ANTHROPIC_API_KEY env var is required");
  process.exit(1);
}

// Optional CSV allowlist of persona slugs to keep active. When set, personas
// not in the list are skipped even if their wallets exist — used to scale LLM
// load down without re-provisioning wallets.
const PERSONA_ALLOWLIST = (() => {
  const raw = process.env.COUNCIL_PERSONAS_ACTIVE?.trim();
  if (!raw) return null;
  const slugs = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return slugs.length > 0 ? new Set(slugs) : null;
})();

// Skip personas missing wallet env (e.g. before council:wallets has run for
// that persona). Warn once at startup, not every cycle.
const ACTIVE_PERSONAS = COUNCIL_PERSONAS.filter((p) => {
  if (PERSONA_ALLOWLIST && !PERSONA_ALLOWLIST.has(p.slug)) {
    return false;
  }
  const ok =
    !!process.env[personaPrivateKeyEnv(p)] && !!process.env[personaAddressEnv(p)];
  if (!ok) {
    console.warn(
      `[council] ${p.emoji} ${p.displayName} is missing wallet env vars — skipping. ` +
      `Run "npm run council:wallets" to provision.`,
    );
  }
  return ok;
});

if (ACTIVE_PERSONAS.length === 0) {
  console.error("[council] No personas have wallets configured. Exiting.");
  process.exit(1);
}

// ── Fetch claim ───────────────────────────────────────────────────────────────
async function fetchClaim(claimId: number): Promise<ClaimOnChain | null> {
  try {
    const [base, market] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: MIMIR_ABI,
        functionName: "getClaim", args: [BigInt(claimId)],
      }) as Promise<readonly any[]>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: MIMIR_ABI,
        functionName: "getClaimMarketConfig", args: [BigInt(claimId)],
      }) as Promise<readonly any[]>,
    ]);
    if (!base[0] || base[0] === "0x0000000000000000000000000000000000000000") {
      return null;
    }
    return {
      id: claimId,
      creator:              base[0] as string,
      question:             base[1] as string,
      creatorPosition:      base[2] as string,
      counterPosition:      base[3] as string,
      resolutionUrl:        base[4] as string,
      creatorStake:         BigInt(base[5]),
      totalChallengerStake: BigInt(base[6]),
      deadline:             BigInt(base[8]),
      state:                Number(base[9]),
      category:             base[13] as string,
      challengerCount:      BigInt(base[15]),
      marketType:           market[0] as string,
      settlementRule:       market[4] as string,
      maxChallengers:       BigInt(market[5]),
      isPrivate:            Boolean(market[6]),
    };
  } catch {
    return null;
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
async function poll(): Promise<void> {
  const now = BigInt(Math.floor(Date.now() / 1000));

  let total: bigint;
  try {
    total = await publicClient.readContract({
      address: CONTRACT_ADDRESS, abi: MIMIR_ABI, functionName: "claimCount",
    }) as bigint;
  } catch (err) {
    console.warn("[council] Failed to read claimCount:", err);
    return;
  }

  console.log(
    `\n[council] ── Poll at ${new Date().toISOString()} ── ${total} claims, ${ACTIVE_PERSONAS.length} personas`,
  );

  // Shared per-cycle evidence cache — one HTTP fetch per claim no matter
  // how many personas need it.
  const evidenceCache = new Map<number, EvidenceCacheEntry>();
  const ctx: PersonaRunnerContext = {
    publicClient,
    contractAddress: CONTRACT_ADDRESS,
    evidenceCache,
  };

  // Pre-load joinable claims so we don't refetch in the inner loop.
  const allClaims: ClaimOnChain[] = [];
  for (let id = 1; id <= Number(total); id++) {
    const claim = await fetchClaim(id);
    if (!claim) continue;
    const joinable =
      (claim.state === STATE.OPEN || claim.state === STATE.ACTIVE) &&
      claim.deadline > now;
    if (joinable) allClaims.push(claim);
  }
  if (allClaims.length === 0) {
    console.log("[council] No joinable claims this round.");
    return;
  }

  // Focus on claims closest to settling — they're the most interesting for
  // the council to weigh in on and keeps LLM-call volume bounded.
  allClaims.sort((a, b) => Number(a.deadline - b.deadline));
  const claims = allClaims.slice(0, MAX_CLAIMS_PER_CYCLE);
  if (claims.length < allClaims.length) {
    console.log(
      `[council] Evaluating ${claims.length} of ${allClaims.length} joinable claims this cycle (deadline-prioritized).`,
    );
  }

  let stakesThisCycle = 0;

  for (const persona of ACTIVE_PERSONAS) {
    for (const claim of claims) {
      try {
        const receipt = await runPersonaForClaim(persona, claim, ctx);
        if (receipt) stakesThisCycle += 1;
      } catch (err) {
        console.error(
          `[council:${persona.slug}] error on claim #${claim.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  console.log(
    stakesThisCycle > 0
      ? `[council] Cycle complete — ${stakesThisCycle} new stakes submitted.`
      : "[council] Cycle complete — no new stakes.",
  );
}

// ── Entry ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log("  Mimir Council — AI personas as economic actors");
  console.log(`  Contract       : ${CONTRACT_ADDRESS}`);
  console.log(`  Network        : ${mantleChain.name} (${mantleChain.id})`);
  console.log(`  LLM            : ${activeLLMProvider()} / ${activeLLMModel()}`);
  console.log(`  Active personas: ${ACTIVE_PERSONAS.length} / ${COUNCIL_PERSONAS.length}`);
  console.log(`  Poll every     : ${POLL_INTERVAL_MS / 1000}s`);
  console.log("───────────────────────────────────────────────");

  for (const p of ACTIVE_PERSONAS) {
    const addr = process.env[personaAddressEnv(p)] as `0x${string}`;
    const bal  = await publicClient.getBalance({ address: addr }).catch(() => 0n);
    console.log(
      `  ${p.emoji} ${p.displayName.padEnd(22)} ${addr.slice(0, 6)}…${addr.slice(-4)} · ${weiToMnt(bal).toFixed(2)} MNT`,
    );
  }
  console.log("═══════════════════════════════════════════════\n");

  const safePoll = async () => {
    try {
      await poll();
    } catch (err) {
      console.error("[council] poll failed, will retry next interval:", err);
    }
  };

  await safePoll();
  setInterval(safePoll, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[council] fatal:", err);
  process.exit(1);
});
