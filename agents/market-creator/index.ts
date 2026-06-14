/**
 * Mimir Market Creator Agent — autonomous market author on Mantle.
 *
 * Pulls public market data (Bybit spot crypto, CoinGecko, ESPN FIFA World Cup
 * fixtures, weather), asks the configured LLM to draft a balanced mix of
 * verifiable claim candidates (crypto price / weather / World Cup match
 * outcomes), scores them, and creates the highest-scoring ones on-chain. Each
 * market costs the agent MNT from its own wallet — opening a claim is itself an
 * economic commitment.
 *
 * Bybit is the primary price source for crypto markets — settlement uses
 * Bybit's public spot tickers as the canonical resolution URL because the
 * endpoint returns a single deterministic last-price that the oracle can
 * re-fetch and hash.
 *
 * Run: npx tsx agents/market-creator/index.ts
 * Env: MARKET_CREATOR_PRIVATE_KEY, MARKET_CREATOR_ADDRESS,
 *      NEXT_PUBLIC_CONTRACT_ADDRESS
 *      + one of: GEMINI_API_KEY (preferred) OR ANTHROPIC_API_KEY
 *      CREATOR_STAKE_MNT=2      (stake per market, default 2 MNT)
 *      MAX_CLAIMS_PER_RUN=5     (max new claims per run, default 5)
 *      RUN_INTERVAL_HOURS=6     (hours between runs, default 6h)
 */

import { formatEther } from "viem";
import { callLLM, activeLLMProvider, activeLLMModel } from "../../lib/llm";
import {
  createMantlePublicClient,
  mantleChain,
  getContractAddress,
  getExplorerTxUrl,
  mntToWei,
  weiToMnt,
} from "../../lib/mantle";
import {
  executeContract,
  buildAbiFunctionSignature,
  toAbiParameters,
  getMarketCreatorWalletId,
  getMarketCreatorAddress,
} from "../../lib/agent-signer";
import { MIMIR_ABI } from "../../lib/mimir-abi";
import { fetchBybitSpotSummary } from "../../lib/sources/bybit";

// ── Config ────────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS    = getContractAddress();
const CREATOR_STAKE_MNT   = Number(process.env.CREATOR_STAKE_MNT ?? "2");
const MAX_CLAIMS_PER_RUN  = Number(process.env.MAX_CLAIMS_PER_RUN ?? "5");
const RUN_INTERVAL_HOURS  = Number(process.env.RUN_INTERVAL_HOURS ?? "6");
const MIN_QUALITY_SCORE   = 70; // 0-100

for (const v of ["MARKET_CREATOR_PRIVATE_KEY", "MARKET_CREATOR_ADDRESS"]) {
  if (!process.env[v]) {
    console.error(`${v} env var is required (run: npm run agent:wallets)`);
    process.exit(1);
  }
}
if (!process.env.GEMINI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
  console.error("GEMINI_API_KEY or ANTHROPIC_API_KEY env var is required");
  process.exit(1);
}

const SIG_CREATE_CLAIM = buildAbiFunctionSignature("createClaim", MIMIR_ABI);

// ── Clients ───────────────────────────────────────────────────────────────────
const publicClient   = createMantlePublicClient();
const CREATOR_WALLET = getMarketCreatorWalletId();
const CREATOR_ADDR   = getMarketCreatorAddress();

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClaimCandidate {
  question:         string;
  creatorPosition:  string;
  counterPosition:  string;
  resolutionUrl:    string;
  category:         string;
  marketType:       string;
  settlementRule:   string;
  deadlineHours:    number;
  qualityScore:     number;
  sourceType:       string;
}

interface SourceBundle {
  bybit:    string;
  crypto:   string;
  worldcup: string;
  weather:  string;
}

// ── Source fetchers ───────────────────────────────────────────────────────────

async function fetchCryptoEvents(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&sparkline=false",
      { headers: { "User-Agent": "Mimir-MarketCreator/1.0" } }
    );
    const coins = await res.json() as any[];
    return coins.map((c: any) =>
      `${c.name} (${c.symbol.toUpperCase()}): $${c.current_price.toFixed(2)}, 24h change: ${c.price_change_percentage_24h?.toFixed(1)}%, market cap: $${(c.market_cap / 1e9).toFixed(1)}B`
    ).join("\n");
  } catch {
    return "BTC: ~$95,000, ETH: ~$3,500, SOL: ~$180 (live data unavailable)";
  }
}

// ESPN's public FIFA World Cup scoreboard (no key needed). We pull today + the
// next two days and keep only UPCOMING / in-progress fixtures — a finished match
// can't be a prediction market. Each fixture carries a DATE-PINNED resolution
// URL (?dates=YYYYMMDD) so the oracle can still fetch that exact day's result
// after the match ends, even once it scrolls off the default scoreboard.
const WORLD_CUP_API = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

async function fetchWorldCupEvents(): Promise<string> {
  const lines: string[] = [];
  for (const offset of [0, 1, 2]) {
    try {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + offset);
      const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
      const res = await fetch(`${WORLD_CUP_API}?dates=${ymd}`, {
        headers: { "User-Agent": "Mimir-MarketCreator/1.0" },
      });
      const data = await res.json() as any;
      for (const e of (data.events ?? [])) {
        if (e.status?.type?.completed) continue; // only tradeable (not finished) fixtures
        const cs   = e.competitions?.[0]?.competitors ?? [];
        const home = cs.find((c: any) => c.homeAway === "home")?.team?.displayName ?? cs[0]?.team?.displayName ?? "?";
        const away = cs.find((c: any) => c.homeAway === "away")?.team?.displayName ?? cs[1]?.team?.displayName ?? "?";
        const status = e.status?.type?.description ?? "scheduled";
        lines.push(
          `${home} vs ${away} — kickoff ${e.date} — ${status} — resolutionUrl: ${WORLD_CUP_API}?dates=${ymd}`
        );
      }
    } catch {
      // skip this day on failure
    }
  }
  if (lines.length === 0) return "No upcoming FIFA World Cup fixtures in the next 3 days.";
  return lines.slice(0, 10).join("\n");
}

async function fetchWeatherEvents(): Promise<string> {
  // Simple approach: predict temperature/weather for major cities
  const cities = ["New York", "London", "Tokyo", "Sydney", "Dubai"];
  const selected = cities[Math.floor(Math.random() * cities.length)];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];
  return `Weather prediction opportunity: ${selected} on ${dateStr}. Use weather.gov or open-meteo.com for resolution.`;
}

// ── Claude drafts claims ──────────────────────────────────────────────────────

async function draftClaimCandidates(sourceData: SourceBundle): Promise<ClaimCandidate[]> {
  const now     = new Date();
  const prompt  = `You are Mimir, an AI that creates high-quality prediction market claims for a MNT-staked market on Mantle.

## Current Data Sources

### Bybit spot prices (primary settlement source)
${sourceData.bybit}

### Crypto Markets (from CoinGecko, secondary)
${sourceData.crypto}

### FIFA World Cup fixtures (from ESPN) — UPCOMING matches only
${sourceData.worldcup}

### Weather Opportunity
${sourceData.weather}

## Task
Create ${MAX_CLAIMS_PER_RUN} prediction market claim candidates. Aim for a BALANCED
MIX across exactly these three themes (roughly even split):
  1. **Crypto price** — settled via Bybit spot tickers
  2. **Weather** — temperature/precipitation for the named city + date
  3. **FIFA World Cup** — outcome of a specific UPCOMING match listed above

Each candidate must be:
- **Verifiable**: resolvable from a specific public URL
- **Binary or near-binary**: clear winner/loser outcome
- **Time-bounded**: deadline between 2-72 hours from now (${now.toISOString()})
- **Specific**: no vague language like "probably" or "might"

Crypto: prefer Bybit as the resolution URL — the API endpoint
"https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT" returns
the exact spot price needed for settlement.

World Cup: use category "sports" and sourceType "espn". Pick a match whose status
is NOT finished. Use the EXACT date-pinned resolutionUrl printed next to that
fixture above (it ends in ?dates=YYYYMMDD) — do not invent a different URL. Name
BOTH teams and the match date in the question and settlement rule, and set the
deadline a few hours AFTER kickoff so the match is finished by then. Frame the
two sides clearly, e.g. "Will <Team A> beat <Team B>?" with the counter covering
draw-or-<Team B>-win.

For each candidate, provide:
{
  "question": "Will [specific thing] happen by [specific date/time]?",
  "creatorPosition": "Yes — [brief reason]",
  "counterPosition": "No — [brief reason]",
  "resolutionUrl": "https://...",  // exact URL the oracle can fetch and parse
  "category": "crypto" | "sports" | "weather" | "culture",
  "marketType": "binary",
  "settlementRule": "Resolve YES if [exact condition] at the resolution URL at deadline.",
  "deadlineHours": <2-72>,
  "qualityScore": <0-100>,  // your confidence this claim is clear and verifiable
  "sourceType": "bybit" | "coingecko" | "espn" | "weather" | "custom"
}

Return a JSON array of ${MAX_CLAIMS_PER_RUN} candidates. Output JSON only.`;

  const text = await callLLM(prompt, { maxTokens: 2000, jsonOnly: true });
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");
    const candidates = JSON.parse(jsonMatch[0]) as ClaimCandidate[];
    return candidates.filter((c) => c.qualityScore >= MIN_QUALITY_SCORE);
  } catch (err) {
    console.warn("[market-creator] Failed to parse candidates:", err);
    return [];
  }
}

// ── Create claim on-chain ─────────────────────────────────────────────────────

async function createClaim(candidate: ClaimCandidate): Promise<string | null> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + candidate.deadlineHours * 3600);
  const stake    = mntToWei(CREATOR_STAKE_MNT);

  // Check balance — keep 3x buffer for gas + future stakes
  const balance = await publicClient.getBalance({ address: CREATOR_ADDR });
  if (balance < stake * 3n) {
    console.warn(`[market-creator] Insufficient balance for ${candidate.question.slice(0, 40)}`);
    return null;
  }

  try {
    const txHash = await executeContract({
      walletId:             CREATOR_WALLET,
      contractAddress:      CONTRACT_ADDRESS,
      abiFunctionSignature: SIG_CREATE_CLAIM,
      abiParameters: toAbiParameters([
        candidate.question,
        candidate.creatorPosition,
        candidate.counterPosition,
        candidate.resolutionUrl,
        deadline,
        stake,
        candidate.category,
        BigInt(0),                   // parentId
        candidate.marketType,
        "pool",                      // oddsMode
        BigInt(0),                   // challengerPayoutBps
        "",                          // handicapLine
        candidate.settlementRule,
        BigInt(100),                 // maxChallengers
        false,                       // isPrivate
        "",                          // inviteKey
      ]),
      amount: formatEther(stake),
      refId:  `mc-${Date.now()}`,
    });
    return txHash;
  } catch (err) {
    console.error(`[market-creator] Failed to create claim:`, err);
    return null;
  }
}

// ── Main run ──────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const balance = await publicClient.getBalance({ address: CREATOR_ADDR });

  console.log(`\n[market-creator] ── Run at ${new Date().toISOString()}`);
  console.log(`[market-creator] Creator : ${CREATOR_ADDR}`);
  console.log(`[market-creator] Balance : ${weiToMnt(balance).toFixed(4)} MNT`);

  // Fetch source data in parallel
  console.log("[market-creator] Fetching market data...");
  const [bybit, crypto, worldcup, weather] = await Promise.all([
    fetchBybitSpotSummary().catch(() => "(Bybit data unavailable)"),
    fetchCryptoEvents(),
    fetchWorldCupEvents(),
    fetchWeatherEvents(),
  ]);

  console.log("[market-creator] Drafting claim candidates with LLM...");
  const candidates = await draftClaimCandidates({ bybit, crypto, worldcup, weather });

  if (candidates.length === 0) {
    console.log("[market-creator] No high-quality candidates this run.");
    return;
  }

  console.log(`[market-creator] ${candidates.length} candidates (score ≥ ${MIN_QUALITY_SCORE}):`);
  candidates.forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.qualityScore}] ${c.question.slice(0, 70)}...`);
  });

  let created = 0;
  for (const candidate of candidates.slice(0, MAX_CLAIMS_PER_RUN)) {
    console.log(`\n[market-creator] Creating: "${candidate.question.slice(0, 60)}..."`);
    const txHash = await createClaim(candidate);
    if (txHash) {
      console.log(`[market-creator] ✓ Created — ${getExplorerTxUrl(txHash)}`);
      created++;
    }
    // Brief pause between claims to avoid nonce issues
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n[market-creator] Created ${created}/${candidates.length} markets this run.`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const balance = await publicClient.getBalance({ address: CREATOR_ADDR });

  console.log("═══════════════════════════════════════════════");
  console.log("  Mimir Market Creator Agent (Mantle / local signer)");
  console.log(`  Creator    : ${CREATOR_ADDR}`);
  console.log(`  Role       : ${CREATOR_WALLET}`);
  console.log(`  Balance    : ${weiToMnt(balance).toFixed(4)} MNT`);
  console.log(`  Network    : ${mantleChain.name} (${mantleChain.id})`);
  console.log(`  LLM        : ${activeLLMProvider()} / ${activeLLMModel()}`);
  console.log(`  Stake/mkt  : ${CREATOR_STAKE_MNT} MNT`);
  console.log(`  Max/run    : ${MAX_CLAIMS_PER_RUN} claims`);
  console.log(`  Interval   : every ${RUN_INTERVAL_HOURS}h`);
  console.log("═══════════════════════════════════════════════\n");

  const safeRun = async () => {
    try {
      await run();
    } catch (err) {
      console.error("[market-creator] Run failed, will retry next interval:", err);
    }
  };

  await safeRun();
  setInterval(safeRun, RUN_INTERVAL_HOURS * 3600 * 1000);
}

main().catch((err) => {
  console.error("[market-creator] Fatal:", err);
  process.exit(1);
});
