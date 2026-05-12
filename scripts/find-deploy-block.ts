/** Print the block number of a given tx. Run: npx tsx scripts/find-deploy-block.ts 0x... */
import { createMantlePublicClient } from "../lib/mantle";

async function main() {
  const txHash = process.argv[2] as `0x${string}`;
  if (!txHash) {
    console.error("Usage: tsx scripts/find-deploy-block.ts <txHash>");
    process.exit(1);
  }
  const client  = createMantlePublicClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  console.log(receipt.blockNumber.toString());
}
main().catch((e) => { console.error(e); process.exit(1); });
