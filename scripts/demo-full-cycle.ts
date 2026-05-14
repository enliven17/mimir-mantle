/**
 * End-to-end demo of the full Mimir cycle on Mantle with the configured LLM
 * settling the verdict:
 *
 *   1. market-creator → createClaim (2 MNT stake, ~150s deadline)
 *   2. oracle         → challengeClaim (2 MNT counter-stake)
 *   3. wait for deadline + the contract's 60s anti-snipe lock
 *   4. oracle (LLM)   → resolveClaim with verifiable evidenceHash + payout
 *
 * Each tx prints an explorer URL so a viewer can verify every step on-chain.
 *
 * Run: npm run demo
 * Env: ORACLE_PRIVATE_KEY, MARKET_CREATOR_PRIVATE_KEY,
 *      NEXT_PUBLIC_CONTRACT_ADDRESS, GEMINI_API_KEY or ANTHROPIC_API_KEY
 */

import { keccak256, toBytes } from "viem";
import {
  createMantlePublicClient,
  getContractAddress,
  getExplorerTxUrl,
  weiToMnt,
  mntToWei,
  mantleChain,
} from "../lib/mantle";
import {
  executeContract,
  buildAbiFunctionSignature,
  toAbiParameters,
  getOracleWalletId,
  getOracleAddress,
  getMarketCreatorWalletId,
  getMarketCreatorAddress,
} from "../lib/agent-signer";
import { callLLM, activeLLMProvider, activeLLMModel } from "../lib/llm";
import { MIMIR_ABI, STATE, WINNER_SIDE } from "../lib/mimir-abi";

// Deadline must clear CHALLENGE_LOCK_SECONDS (60s) + room for the challenge tx
// to land before the lock kicks in.
const DEADLINE_SECONDS = 150;
const STAKE_MNT        = 2;

const SIG_CREATE    = buildAbiFunctionSignature("createClaim",    MIMIR_ABI);
const SIG_CHALLENGE = buildAbiFunctionSignature("challengeClaim", MIMIR_ABI);
const SIG_RESOLVE   = buildAbiFunctionSignature("resolveClaim",   MIMIR_ABI);

const RESOLUTION_URL = "https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT";

async function main(): Promise<void> {
  const client          = createMantlePublicClient();
  const contractAddress = getContractAddress();
  const oracleWallet    = getOracleWalletId();
  const oracleAddr      = getOracleAddress();
  const creatorWallet   = getMarketCreatorWalletId();
  const creatorAddr     = getMarketCreatorAddress();

  console.log("─── Mimir full-cycle demo (Mantle) ───");
  console.log(`Network : ${mantleChain.name} (${mantleChain.id})`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`LLM     : ${activeLLMProvider()} / ${activeLLMModel()}`);
  console.log(`Creator : ${creatorAddr}`);
  console.log(`Oracle  : ${oracleAddr}`);

  const stakeWei = mntToWei(STAKE_MNT);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

  // 1. CREATE
  console.log(`\n[1/4] market-creator opens a claim (deadline in ${DEADLINE_SECONDS}s)…`);
  const createTx = await executeContract({
    walletId:             creatorWallet,
    contractAddress,
    abiFunctionSignature: SIG_CREATE,
    abiParameters: toAbiParameters([
      "Mimir demo — is the Bitcoin spot price > $100,000 on Bybit at deadline?",
      "Yes, BTC > $100k",
      "No, BTC < $100k",
      RESOLUTION_URL,
      deadline,
      stakeWei,
      "crypto",
      0n, "binary", "pool", 0n, "",
      "Settle YES if the lastPrice in the Bybit BTCUSDT spot ticker is > 100000 at deadline.",
      100n, false, "",
    ]),
    amount: String(STAKE_MNT),
    refId:  `demo-create-${Date.now()}`,
  });
  console.log(`     create tx: ${getExplorerTxUrl(createTx)}`);

  const newClaimId = (await client.readContract({
    address: contractAddress, abi: MIMIR_ABI, functionName: "claimCount",
  })) as bigint;
  const claimId = Number(newClaimId);
  console.log(`     claim id : #${claimId}`);

  // 2. CHALLENGE — oracle stakes on the opposite side
  console.log(`\n[2/4] oracle challenges (stakes ${STAKE_MNT} MNT on Side B)…`);
  const challengeTx = await executeContract({
    walletId:             oracleWallet,
    contractAddress,
    abiFunctionSignature: SIG_CHALLENGE,
    abiParameters:        toAbiParameters([BigInt(claimId), stakeWei, ""]),
    amount:               String(STAKE_MNT),
    refId:                `demo-challenge-${claimId}`,
  });
  console.log(`     challenge tx: ${getExplorerTxUrl(challengeTx)}`);

  // 3. WAIT
  const sleepMs = (DEADLINE_SECONDS + 5) * 1000;
  console.log(`\n[3/4] Waiting ${sleepMs / 1000}s for deadline…`);
  await new Promise((r) => setTimeout(r, sleepMs));

  const claim = await client.readContract({
    address: contractAddress, abi: MIMIR_ABI, functionName: "getClaim", args: [BigInt(claimId)],
  }) as readonly any[];
  const stateNow = Number(claim[9]);
  console.log(`     state    : ${stateNow} (1=ACTIVE expected)`);
  if (stateNow !== STATE.ACTIVE) throw new Error("Claim not ACTIVE — challenge may have failed");

  // 4. RESOLVE — LLM evaluates evidence, oracle calls resolveClaim
  console.log("\n[4/4] Fetching evidence + asking LLM for verdict…");
  const evidenceUrl = claim[4] as string;
  const evidence = await fetchEvidence(evidenceUrl);
  console.log(`     evidence : ${evidence.slice(0, 120)}…`);

  const prompt = `You are Mimir, an impartial AI oracle for a prediction market on Mantle.

Claim: ${claim[1]}
Side A (creator): ${claim[2]}
Side B (challenger): ${claim[3]}
Resolution source: ${evidenceUrl}
Settlement rule: ${claim[11] || "Use the resolution source to decide."}

Evidence fetched from the source (Bybit V5 spot ticker JSON):
<evidence>
${evidence}
</evidence>

Return JSON only:
{ "verdict": "CREATOR_WINS" | "CHALLENGERS_WIN" | "DRAW" | "UNRESOLVABLE",
  "confidence": <0-100>,
  "explanation": "<one sentence>" }`;

  const text = await callLLM(prompt, { maxTokens: 512, jsonOnly: true });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`LLM did not return JSON: ${text.slice(0, 200)}`);
  const verdict = JSON.parse(match[0]) as { verdict: string; confidence: number; explanation: string };
  console.log(`     verdict  : ${verdict.verdict} (${verdict.confidence}%)`);
  console.log(`     reason   : ${verdict.explanation}`);

  const sideMap: Record<string, number> = {
    CREATOR_WINS:    WINNER_SIDE.CREATOR,
    CHALLENGERS_WIN: WINNER_SIDE.CHALLENGERS,
    DRAW:            WINNER_SIDE.DRAW,
    UNRESOLVABLE:    WINNER_SIDE.UNRESOLVABLE,
  };
  const side = sideMap[verdict.verdict] ?? WINNER_SIDE.UNRESOLVABLE;
  const evidenceHash = keccak256(toBytes(evidence));

  console.log("     submitting resolveClaim…");
  const resolveTx = await executeContract({
    walletId:             oracleWallet,
    contractAddress,
    abiFunctionSignature: SIG_RESOLVE,
    abiParameters: toAbiParameters([
      BigInt(claimId),
      side,
      verdict.explanation.slice(0, 400),
      Math.max(0, Math.min(100, Math.round(verdict.confidence ?? 50))),
      evidenceHash,
    ]),
    refId: `demo-resolve-${claimId}`,
  });
  console.log(`     resolve tx: ${getExplorerTxUrl(resolveTx)}`);

  const final = await client.readContract({
    address: contractAddress, abi: MIMIR_ABI, functionName: "getClaim", args: [BigInt(claimId)],
  }) as readonly any[];
  const finalState = Number(final[9]);
  const winnerSide = Number(final[10]);
  const oracleBal  = await client.getBalance({ address: oracleAddr });
  const creatorBal = await client.getBalance({ address: creatorAddr });

  console.log("\n─── Final state ───");
  console.log(`Claim #${claimId} state: ${finalState === STATE.RESOLVED ? "RESOLVED" : finalState}`);
  console.log(`Winner side          : ${winnerSide} (1=creator, 2=challengers, 3=draw, 4=unresolvable)`);
  console.log(`Evidence hash on-chain: ${final[17]}`);
  console.log(`Oracle  balance      : ${weiToMnt(oracleBal).toFixed(4)} MNT`);
  console.log(`Creator balance      : ${weiToMnt(creatorBal).toFixed(4)} MNT`);
  console.log("\n✓ Full Mimir cycle on Mantle: create → challenge → settle → on-chain payout.");
  console.log("  Every decision permanently recorded on Mantle. Turing-Test ready.");
}

async function fetchEvidence(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mimir-Demo/2.0" },
      signal:  AbortSignal.timeout(15_000),
    });
    const txt = await res.text();
    return txt
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch (e: any) {
    return `(failed to fetch ${url}: ${e?.message ?? "unknown"})`;
  }
}

main().catch((e) => { console.error("\nDemo failed:", e?.message ?? e); process.exit(1); });
