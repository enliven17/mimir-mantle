/**
 * Fund the 10 council persona wallets with native MNT from the market-creator
 * wallet, so each persona can stake (MIN_STAKE = 2 MNT) + pay gas.
 *
 * Idempotent: skips any persona already holding >= the target amount.
 *
 * Run:  npm run council:fund
 * Env:  MARKET_CREATOR_PRIVATE_KEY (funder), COUNCIL_<SLUG>_ADDRESS,
 *       COUNCIL_FUND_MNT (per-persona target, default 8)
 */

import {
  createMantlePublicClient,
  createMantleWalletClientWithKey,
  mantleChain,
  getExplorerTxUrl,
  mntToWei,
  weiToMnt,
} from "../lib/mantle";
import { COUNCIL_PERSONAS, personaAddressEnv } from "../agents/council/personas";

const FUND_MNT = Number(process.env.COUNCIL_FUND_MNT ?? "8");

async function main(): Promise<void> {
  const funderKey = process.env.MARKET_CREATOR_PRIVATE_KEY?.trim();
  if (!funderKey) throw new Error("MARKET_CREATOR_PRIVATE_KEY env var is required");

  const publicClient = createMantlePublicClient();
  const wallet       = createMantleWalletClientWithKey(funderKey);
  const funder       = wallet.account!;

  const targets = COUNCIL_PERSONAS
    .map((p) => ({ p, addr: process.env[personaAddressEnv(p)]?.trim() as `0x${string}` | undefined }))
    .filter((t): t is { p: typeof COUNCIL_PERSONAS[number]; addr: `0x${string}` } => !!t.addr);

  if (targets.length === 0) {
    throw new Error("No COUNCIL_*_ADDRESS env vars found. Run: npm run council:wallets");
  }

  const target = mntToWei(FUND_MNT);
  const funderBal = await publicClient.getBalance({ address: funder.address });

  console.log("═══════════════════════════════════════════════");
  console.log("  Fund Mimir Council wallets");
  console.log(`  Network    : ${mantleChain.name} (${mantleChain.id})`);
  console.log(`  Funder     : ${funder.address}`);
  console.log(`  Funder bal : ${weiToMnt(funderBal).toFixed(2)} MNT`);
  console.log(`  Per persona: ${FUND_MNT} MNT  (${targets.length} personas)`);
  console.log("═══════════════════════════════════════════════\n");

  let funded = 0;
  let sentTotal = 0n;

  for (const { p, addr } of targets) {
    const bal = await publicClient.getBalance({ address: addr });
    if (bal >= target) {
      console.log(`✓ ${p.emoji} ${p.displayName.padEnd(20)} already has ${weiToMnt(bal).toFixed(2)} MNT — skip`);
      continue;
    }
    const need = target - bal;

    if (funderBal - sentTotal < need + mntToWei(0.5)) {
      console.warn(`⚠ funder running low — stopping before ${p.displayName}`);
      break;
    }

    const txHash = await wallet.sendTransaction({
      to:      addr,
      value:   need,
      account: funder,
      chain:   mantleChain,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    sentTotal += need;
    funded++;
    console.log(`✚ ${p.emoji} ${p.displayName.padEnd(20)} +${weiToMnt(need).toFixed(2)} MNT — ${getExplorerTxUrl(txHash)}`);
  }

  console.log(`\nDone — funded ${funded}/${targets.length} personas (${weiToMnt(sentTotal).toFixed(2)} MNT total).`);
}

main().catch((err) => {
  console.error("Fund failed:", err?.message ?? err);
  process.exit(1);
});
