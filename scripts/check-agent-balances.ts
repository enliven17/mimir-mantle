/**
 * Quick read of both Mimir agent wallets on Mantle.
 * Run: npx tsx --env-file=.env.local scripts/check-agent-balances.ts
 */
import { createMantlePublicClient, weiToMnt, getExplorerAddressUrl, mantleChain } from "../lib/mantle";

async function main(): Promise<void> {
  const oracle  = process.env.ORACLE_ADDRESS;
  const creator = process.env.MARKET_CREATOR_ADDRESS;
  if (!oracle || !creator) {
    console.error("Missing ORACLE_ADDRESS or MARKET_CREATOR_ADDRESS (run: npm run agent:wallets)");
    process.exit(1);
  }

  const client = createMantlePublicClient();
  const [ob, cb] = await Promise.all([
    client.getBalance({ address: oracle  as `0x${string}` }),
    client.getBalance({ address: creator as `0x${string}` }),
  ]);

  console.log(`${mantleChain.name} balances:\n`);
  console.log(`  oracle          ${oracle}`);
  console.log(`                  ${weiToMnt(ob).toFixed(4)} MNT`);
  console.log(`                  ${getExplorerAddressUrl(oracle)}\n`);
  console.log(`  market-creator  ${creator}`);
  console.log(`                  ${weiToMnt(cb).toFixed(4)} MNT`);
  console.log(`                  ${getExplorerAddressUrl(creator)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
