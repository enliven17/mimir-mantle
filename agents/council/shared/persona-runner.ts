/**
 * Per-persona evaluation + staking pipeline (Mantle / local-key signer).
 *
 * Given a persona, a claim, and shared cycle context, this:
 *   1. Runs cheap skip checks (already-challenged, self-created, private, full).
 *   2. Branches on archetype:
 *        - rule-based → contrarian / whale-follow evaluators (no LLM)
 *        - llm-biased / specialist / micro → persona-LLM with cached evidence
 *   3. Decides whether to stake and how much (Kelly for LLM personas).
 *   4. Submits challengeClaim through the persona's own local EVM key.
 */

import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  mantleChain,
  getMantleRpcUrl,
  weiToMnt,
  mntToWei,
  getExplorerTxUrl,
} from "../../../lib/mantle";
import { MIMIR_ABI } from "../../../lib/mimir-abi";
import {
  type PersonaSpec,
  personaPrivateKeyEnv,
  personaAddressEnv,
} from "../personas";
import { getOrFetchEvidence } from "./evidence-cache";
import { evaluateClaimAsPersona, type PersonaVerdict } from "./persona-llm";
import {
  evaluateContrarian,
  evaluateWhaleWatcher,
} from "./persona-rules";
import type {
  ClaimOnChain,
  PersonaDecision,
  PersonaRunnerContext,
  PersonaStakeReceipt,
} from "./types";

const DEFAULT_MIN_CONFIDENCE = 75;
const DEFAULT_STAKE_MNT      = 2;

/**
 * LLM free tiers cap requests/min. We chain LLM calls serially inside a
 * single process and add a small delay between them so a burst across
 * 8+ personas doesn't trip 429s. Overridable via COUNCIL_LLM_THROTTLE_MS.
 */
const LLM_THROTTLE_MS = Number(process.env.COUNCIL_LLM_THROTTLE_MS ?? 4500);
let lastLlmCallAt = 0;

async function throttleLlm(): Promise<void> {
  const now = Date.now();
  const since = now - lastLlmCallAt;
  if (since < LLM_THROTTLE_MS) {
    await new Promise((r) => setTimeout(r, LLM_THROTTLE_MS - since));
  }
  lastLlmCallAt = Date.now();
}

// ── Per-persona local-key wallet clients (cached) ──────────────────────────────
// viem routes through eth_sendRawTransaction when given a local Account — the
// public Mantle RPC blocks eth_sendTransaction (address-only) as not whitelisted.
const _walletClients = new Map<string, { client: WalletClient; account: PrivateKeyAccount }>();

function personaWallet(persona: PersonaSpec): { client: WalletClient; account: PrivateKeyAccount } | null {
  const cached = _walletClients.get(persona.slug);
  if (cached) return cached;
  const pk = process.env[personaPrivateKeyEnv(persona)]?.trim();
  if (!pk) return null;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const client  = createWalletClient({
    chain:     mantleChain,
    transport: http(getMantleRpcUrl()),
    account,
  });
  const entry = { client, account };
  _walletClients.set(persona.slug, entry);
  return entry;
}

/**
 * Kelly Criterion fraction of bankroll for a given confidence,
 * conservative cap at 15% of bankroll per bet (lower than oracle's
 * 25% because personas play across many markets).
 */
function kellyFraction(confidencePct: number, netOdds = 1.0): number {
  const p = confidencePct / 100;
  const q = 1 - p;
  const f = (p * netOdds - q) / netOdds;
  return Math.max(0, Math.min(0.15, f));
}

function categoryMatches(persona: PersonaSpec, claim: ClaimOnChain): boolean {
  if (!persona.categoryFilter || persona.categoryFilter.length === 0) {
    return true;
  }
  const c = (claim.category ?? "").toLowerCase();
  return persona.categoryFilter.some((tag) => c.includes(tag.toLowerCase()));
}

/**
 * Pure decision step — no on-chain writes. Useful for the CouncilVoteWidget
 * which wants to surface a persona's verdict without actually staking.
 */
export async function evaluatePersonaForClaim(
  persona: PersonaSpec,
  claim: ClaimOnChain,
  ctx: PersonaRunnerContext,
): Promise<PersonaDecision & { verdict?: PersonaVerdict }> {
  // Specialists only consider claims in their category.
  if (!categoryMatches(persona, claim)) {
    return {
      shouldStake: false,
      stakeMnt:    0,
      rationale:   `${persona.displayName} only watches ${persona.categoryFilter?.join(" / ")} markets — this one is out of scope.`,
      skipReason:  "category-filter",
    };
  }

  // Rule-based personas: no LLM call.
  if (persona.archetype === "rule-based") {
    if (persona.ruleEvaluator === "contrarian") {
      return evaluateContrarian(persona, claim);
    }
    if (persona.ruleEvaluator === "whale-follow") {
      return evaluateWhaleWatcher(persona, claim, ctx.publicClient, ctx.contractAddress);
    }
    return {
      shouldStake: false,
      stakeMnt:    0,
      rationale:   `${persona.displayName} has no rule evaluator wired.`,
      skipReason:  "abstain-low-confidence",
    };
  }

  // LLM-based path (llm-biased, specialist, micro).
  const evidence = await getOrFetchEvidence(claim.id, claim.resolutionUrl, ctx.evidenceCache);
  if (evidence.fetcher === "none") {
    return {
      shouldStake: false,
      stakeMnt:    0,
      rationale:   `${persona.displayName}: no usable evidence at the resolution URL — abstaining.`,
      skipReason:  "no-evidence",
    };
  }

  let verdict: PersonaVerdict;
  try {
    await throttleLlm();
    verdict = await evaluateClaimAsPersona(persona, claim, evidence.text);
  } catch (err) {
    return {
      shouldStake: false,
      stakeMnt:    0,
      rationale:   `${persona.displayName}: LLM call failed (${err instanceof Error ? err.message : "unknown"}).`,
      skipReason:  "llm-failed",
    };
  }

  const minConf = persona.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  if (verdict.verdict === "CREATOR_WINS") {
    return {
      shouldStake: false,
      stakeMnt:    0,
      rationale:   `${persona.displayName} agrees with the creator (${verdict.confidence}%): ${verdict.explanation}`,
      confidence:  verdict.confidence,
      skipReason:  "abstain-agrees-with-creator",
      verdict,
    };
  }

  if (verdict.verdict !== "CHALLENGERS_WIN" || verdict.confidence < minConf) {
    return {
      shouldStake: false,
      stakeMnt:    0,
      rationale:   `${persona.displayName} won't stake: verdict ${verdict.verdict} at ${verdict.confidence}% (threshold ${minConf}%). ${verdict.explanation}`,
      confidence:  verdict.confidence,
      skipReason:  "abstain-low-confidence",
      verdict,
    };
  }

  // Confident enough to stake. Size with Kelly in runPersonaForClaim where the
  // wallet balance is read. Here we surface the base stake from the spec.
  return {
    shouldStake: true,
    stakeMnt:    persona.stakeMnt ?? DEFAULT_STAKE_MNT,
    rationale:   `${persona.displayName} stakes: ${verdict.explanation}`,
    confidence:  verdict.confidence,
    verdict,
  };
}

/**
 * Full pipeline — runs decision + on-chain stake if all guards pass.
 * Returns a receipt when a stake is submitted, null otherwise.
 */
export async function runPersonaForClaim(
  persona: PersonaSpec,
  claim: ClaimOnChain,
  ctx: PersonaRunnerContext,
): Promise<PersonaStakeReceipt | null> {
  const wallet = personaWallet(persona);
  const addressRaw = process.env[personaAddressEnv(persona)];
  if (!wallet || !addressRaw) {
    console.warn(
      `[council:${persona.slug}] missing wallet env — run "npm run council:wallets" first.`,
    );
    return null;
  }
  const address = addressRaw.toLowerCase() as `0x${string}`;

  // Cheap skip checks — same shape the oracle uses, scoped to this persona.
  if (claim.isPrivate) return null;
  if (claim.creator.toLowerCase() === address) return null;
  if (claim.challengerCount >= claim.maxChallengers) return null;

  // hasChallenged is an idempotent on-chain guard — skip if we're already in.
  let alreadyIn = false;
  try {
    alreadyIn = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: MIMIR_ABI,
      functionName: "hasChallenged",
      args: [BigInt(claim.id), address as `0x${string}`],
    }) as boolean;
  } catch {
    // If the read fails, default to skipping rather than risking double-stake.
    return null;
  }
  if (alreadyIn) return null;

  // Wallet balance — keep a 2x stake buffer (stake + gas) so we never drain.
  const balance = await ctx.publicClient.getBalance({ address: address as `0x${string}` });
  const baseStakeMnt = persona.stakeMnt ?? DEFAULT_STAKE_MNT;
  const minRequired = mntToWei(baseStakeMnt * 2);
  if (balance < minRequired) {
    console.log(
      `[council:${persona.slug}] insufficient balance (${weiToMnt(balance).toFixed(2)} MNT), skipping`,
    );
    return null;
  }

  // Decide.
  const decision = await evaluatePersonaForClaim(persona, claim, ctx);
  if (!decision.shouldStake) {
    return null;
  }

  // For LLM personas, apply Kelly sizing on top of the base stake.
  // Rule personas don't have a confidence score — they use the base stake as-is.
  let stakeMnt = decision.stakeMnt;
  if (decision.confidence && decision.confidence >= (persona.minConfidence ?? DEFAULT_MIN_CONFIDENCE)) {
    const kelly = kellyFraction(decision.confidence);
    const bankrollMnt = Number(balance) / 1e18;
    const kellyStake = Math.max(
      baseStakeMnt,
      Math.min(bankrollMnt * kelly, bankrollMnt * 0.10),
    );
    stakeMnt = Math.round(kellyStake * 100) / 100;
  }

  // Submit challengeClaim through the persona's own key.
  const stakeWei = mntToWei(stakeMnt);
  const txHash = await wallet.client.writeContract({
    address:      ctx.contractAddress,
    abi:          MIMIR_ABI,
    functionName: "challengeClaim",
    args:         [BigInt(claim.id), stakeWei, ""],
    value:        stakeWei,
    account:      wallet.account,
    chain:        mantleChain,
  });
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error(`challengeClaim reverted for ${persona.slug} on claim #${claim.id}`);
  }

  console.log(
    `[council:${persona.slug}] ✓ Staked ${stakeMnt} MNT on claim #${claim.id} — ${getExplorerTxUrl(txHash)}`,
  );
  console.log(`[council:${persona.slug}]   ${decision.rationale.slice(0, 160)}`);

  return {
    persona,
    claimId:   claim.id,
    stakeMnt,
    txHash,
    rationale: decision.rationale,
  };
}
