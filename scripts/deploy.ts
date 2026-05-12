/**
 * Compile + deploy Mimir.sol to Mantle (Sepolia by default).
 *
 * Reads bytecode from artifacts/Mimir.bin (run `npm run compile:contract` first
 * if it doesn't exist) and deploys with vanilla viem.
 *
 * After deploy:
 *   - writes NEXT_PUBLIC_CONTRACT_ADDRESS into .env.local
 *   - hands ownership to MARKET_CREATOR_ADDRESS so the agent can call
 *     registerAgent(...) without needing the deployer key around
 *
 * Idempotent: aborts if NEXT_PUBLIC_CONTRACT_ADDRESS is already set.
 *
 * Run: npm run deploy:contract
 * Env: DEPLOYER_PRIVATE_KEY, ORACLE_ADDRESS, MARKET_CREATOR_ADDRESS
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import solc from "solc";
import {
  mantleChain,
  getMantleRpcUrl,
  getExplorerTxUrl,
  getExplorerAddressUrl,
  weiToMnt,
} from "../lib/mantle";
import { MIMIR_ABI } from "../lib/mimir-abi";

const ENV_PATH       = resolve(process.cwd(), ".env.local");
const CONTRACT_PATH  = resolve(process.cwd(), "contracts/Mimir.sol");
const ARTIFACTS_DIR  = resolve(process.cwd(), "artifacts");
const BYTECODE_PATH  = resolve(ARTIFACTS_DIR, "Mimir.bin");

const DEPLOY_ABI = parseAbi(["constructor(address _oracle)"]);

// ── env helpers ──────────────────────────────────────────────────────────────
function readEnvRaw(): string {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
}
function readEnvVar(raw: string, key: string): string | undefined {
  const m = raw.match(new RegExp(`^${key}=(.+?)$`, "m"));
  return m?.[1]?.trim();
}
function upsertEnv(raw: string, key: string, value: string): string {
  if (new RegExp(`^${key}=`, "m").test(raw)) {
    return raw.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  }
  if (new RegExp(`^#\\s*${key}=`, "m").test(raw)) {
    return raw.replace(new RegExp(`^#\\s*${key}=.*$`, "m"), `${key}=${value}`);
  }
  return raw.endsWith("\n") ? `${raw}${key}=${value}\n` : `${raw}\n${key}=${value}\n`;
}
function envOrDie(key: string): string {
  const v = process.env[key]?.trim();
  if (!v) throw new Error(`${key} env var is required`);
  return v;
}

// ── compile fallback ─────────────────────────────────────────────────────────
interface SolcOutput {
  errors?: Array<{ severity: string; formattedMessage: string }>;
  contracts?: Record<string, Record<string, { evm: { bytecode: { object: string } } }>>;
}

function compileBytecode(): `0x${string}` {
  console.log(`Compiling ${CONTRACT_PATH}…`);
  const source = readFileSync(CONTRACT_PATH, "utf8");
  const input = {
    language: "Solidity",
    sources: { "Mimir.sol": { content: source } },
    settings: {
      optimizer:        { enabled: true, runs: 200 },
      viaIR:            true,
      outputSelection: { "*": { "*": ["evm.bytecode.object"] } },
    },
  };
  const output: SolcOutput = JSON.parse(solc.compile(JSON.stringify(input)));
  const fatal = output.errors?.filter((e) => e.severity === "error") ?? [];
  if (fatal.length > 0) {
    fatal.forEach((e) => console.error(e.formattedMessage));
    throw new Error("Solidity compilation failed");
  }
  const raw = output.contracts?.["Mimir.sol"]?.Mimir?.evm?.bytecode?.object;
  if (!raw) throw new Error("No bytecode produced");
  if (!existsSync(ARTIFACTS_DIR)) mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(BYTECODE_PATH, raw);
  return `0x${raw}` as `0x${string}`;
}

function loadBytecode(): `0x${string}` {
  if (existsSync(BYTECODE_PATH)) {
    const raw = readFileSync(BYTECODE_PATH, "utf8").trim();
    return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  }
  return compileBytecode();
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const envRaw = readEnvRaw();
  const existing =
    readEnvVar(envRaw, "NEXT_PUBLIC_CONTRACT_ADDRESS") ??
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (existing && existing !== "0x0000000000000000000000000000000000000000") {
    console.log(`Mimir already deployed at ${existing}`);
    console.log("Clear NEXT_PUBLIC_CONTRACT_ADDRESS from .env.local to redeploy.");
    return;
  }

  const deployerKey  = envOrDie("DEPLOYER_PRIVATE_KEY") as `0x${string}`;
  const oracleAddr   = envOrDie("ORACLE_ADDRESS")         as `0x${string}`;
  const creatorAddr  = envOrDie("MARKET_CREATOR_ADDRESS") as `0x${string}`;

  const account = privateKeyToAccount(deployerKey);
  const rpc     = getMantleRpcUrl();

  const publicClient = createPublicClient({ chain: mantleChain, transport: http(rpc) });
  const wallet       = createWalletClient({ chain: mantleChain, transport: http(rpc), account });

  const balance = await publicClient.getBalance({ address: account.address });

  console.log("═══════════════════════════════════════════════");
  console.log("  Mimir contract deployment");
  console.log(`  Network          : ${mantleChain.name} (${mantleChain.id})`);
  console.log(`  RPC              : ${rpc}`);
  console.log(`  Deployer         : ${account.address}`);
  console.log(`  Deployer balance : ${weiToMnt(balance).toFixed(4)} MNT`);
  console.log(`  Oracle           : ${oracleAddr}`);
  console.log(`  Final owner      : ${creatorAddr}`);
  console.log("═══════════════════════════════════════════════\n");

  if (balance === 0n) {
    throw new Error("Deployer has 0 MNT. Fund it via https://faucet.sepolia.mantle.xyz");
  }

  const bytecode = loadBytecode();

  console.log(`Deploying… (bytecode ${bytecode.length / 2 - 1} bytes)`);
  const deployHash = await wallet.deployContract({
    abi:      DEPLOY_ABI,
    bytecode,
    args:     [oracleAddr],
  });
  console.log(`  tx ${getExplorerTxUrl(deployHash)}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (receipt.status === "reverted") throw new Error("Deployment reverted");
  const contractAddress = receipt.contractAddress;
  if (!contractAddress) throw new Error("No contractAddress in receipt");
  console.log(`✓ Deployed at ${contractAddress}`);

  if (creatorAddr.toLowerCase() !== account.address.toLowerCase()) {
    console.log("\nTransferring ownership to market-creator…");
    const ownerTxHash = (await wallet.writeContract({
      address:      contractAddress,
      abi:          MIMIR_ABI,
      functionName: "transferOwnership",
      args:         [creatorAddr],
      chain:        mantleChain,
    })) as Hex;
    await publicClient.waitForTransactionReceipt({ hash: ownerTxHash });
    console.log(`  ✓ ${getExplorerTxUrl(ownerTxHash)}`);
  }

  let updated = upsertEnv(envRaw, "NEXT_PUBLIC_CONTRACT_ADDRESS", contractAddress);
  if (receipt.blockNumber !== undefined && receipt.blockNumber !== null) {
    updated = upsertEnv(updated, "NEXT_PUBLIC_DEPLOY_BLOCK", receipt.blockNumber.toString());
  }
  writeFileSync(ENV_PATH, updated);

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("DEPLOYED");
  console.log("");
  console.log(`Contract : ${contractAddress}`);
  console.log(`Owner    : ${creatorAddr}`);
  console.log(`Oracle   : ${oracleAddr}`);
  console.log(`Explorer : ${getExplorerAddressUrl(contractAddress)}`);
  console.log("");
  console.log("NEXT_PUBLIC_CONTRACT_ADDRESS written to .env.local");
  console.log("Next: npm run agent:register   (mint ERC-8004 + Mimir.registerAgent)");
  console.log("Next: npm run workers          (start oracle + market-creator)");
  console.log("────────────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\nDeploy failed:", err?.message ?? err);
  process.exit(1);
});
