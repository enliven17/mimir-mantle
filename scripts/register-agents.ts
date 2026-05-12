/**
 * Register Mimir agents against the ERC-8004 IdentityRegistry on Mantle and
 * mirror their tokenIds into the Mimir contract via `registerAgent(...)`.
 *
 * Each agent gets:
 *   1. An on-chain identity NFT in Mantle's official IdentityRegistry
 *      (deployed by Mantle, Feb 2026; address tracked in
 *       ERC8004_IDENTITY_REGISTRY env var)
 *   2. A role mapping in Mimir.sol (`agentRole[wallet] = "oracle" | ...`)
 *      + the ERC-8004 tokenId mirrored to `agentIdentityId[wallet]`
 *
 * If ERC8004_IDENTITY_REGISTRY is not configured (e.g. on testnet before the
 * registry is deployed there), we skip the ERC-8004 mint step but still write
 * the role mapping into Mimir.sol so off-chain consumers can attribute
 * settlement events.
 *
 * Run: npm run agent:register
 * Env: ORACLE_ADDRESS, MARKET_CREATOR_ADDRESS,
 *      NEXT_PUBLIC_CONTRACT_ADDRESS  (Mimir.sol address),
 *      DEPLOYER_PRIVATE_KEY          (Mimir contract owner),
 *      ERC8004_IDENTITY_REGISTRY     (optional — Mantle's official registry)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  mantleChain,
  getMantleRpcUrl,
  getContractAddress,
  getExplorerTxUrl,
} from "../lib/mantle";
import { MIMIR_ABI } from "../lib/mimir-abi";

const ERC8004_REGISTRY = (process.env.ERC8004_IDENTITY_REGISTRY ?? "").trim();

// Minimal ERC-8004 IdentityRegistry surface — only the bits we need to mint
// an agent NFT and read back its id. The full Mantle reference contract has
// more (setAgentURI, setMetadata, …) but we keep this script focused.
const IDENTITY_REGISTRY_ABI = parseAbi([
  "function register(address agentOwner, string agentURI) returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
]);

interface AgentRecord {
  role:     "oracle" | "market-creator";
  address:  `0x${string}`;
  uri:      string;
}

function envOrDie(key: string): string {
  const v = process.env[key]?.trim();
  if (!v) throw new Error(`${key} env var is required`);
  return v;
}

const AGENTS: AgentRecord[] = [
  {
    role:    "oracle",
    address: envOrDie("ORACLE_ADDRESS") as `0x${string}`,
    uri:     "ipfs://placeholder/mimir-oracle.json",
  },
  {
    role:    "market-creator",
    address: envOrDie("MARKET_CREATOR_ADDRESS") as `0x${string}`,
    uri:     "ipfs://placeholder/mimir-market-creator.json",
  },
];

async function mintIdentityIfPossible(
  owner: `0x${string}`,
  uri: string,
  signer: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
): Promise<bigint | null> {
  if (!ERC8004_REGISTRY) return null;
  const registry = ERC8004_REGISTRY as `0x${string}`;

  // If the agent already has an identity NFT, reuse it.
  try {
    const balance = (await publicClient.readContract({
      address: registry,
      abi:     IDENTITY_REGISTRY_ABI,
      functionName: "balanceOf",
      args: [owner],
    })) as bigint;
    if (balance > 0n) {
      const existing = (await publicClient.readContract({
        address: registry,
        abi:     IDENTITY_REGISTRY_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [owner, 0n],
      })) as bigint;
      console.log(`  already has identity #${existing} — reusing`);
      return existing;
    }
  } catch (err: any) {
    console.warn(`  IdentityRegistry balanceOf failed (${err?.shortMessage ?? err?.message ?? "?"}). Skipping mint.`);
    return null;
  }

  // Mint a new identity NFT.
  try {
    const txHash = (await (signer as any).writeContract({
      address: registry,
      abi:     IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args:    [owner, uri],
      chain:   mantleChain,
    })) as Hex;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new Error("register() reverted");
    console.log(`  minted identity: ${getExplorerTxUrl(txHash)}`);

    const idx = (await publicClient.readContract({
      address: registry,
      abi:     IDENTITY_REGISTRY_ABI,
      functionName: "tokenOfOwnerByIndex",
      args: [owner, 0n],
    })) as bigint;
    return idx;
  } catch (err: any) {
    console.warn(`  IdentityRegistry.register failed (${err?.shortMessage ?? err?.message ?? "?"}). Continuing without ERC-8004 id.`);
    return null;
  }
}

async function main(): Promise<void> {
  const mimirAddr     = getContractAddress();
  const deployerKey   = envOrDie("DEPLOYER_PRIVATE_KEY") as `0x${string}`;
  const deployerAcct  = privateKeyToAccount(deployerKey);

  if (mimirAddr === "0x0000000000000000000000000000000000000000") {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS not set — deploy Mimir first.");
  }

  const publicClient = createPublicClient({ chain: mantleChain, transport: http(getMantleRpcUrl()) });
  const signer       = createWalletClient({ chain: mantleChain, transport: http(getMantleRpcUrl()), account: deployerAcct });

  console.log("═══════════════════════════════════════════════");
  console.log("  Mimir Agent Registration");
  console.log(`  Mimir contract       : ${mimirAddr}`);
  console.log(`  ERC-8004 registry    : ${ERC8004_REGISTRY || "(none — skipping NFT mint)"}`);
  console.log(`  Network              : ${mantleChain.name} (${mantleChain.id})`);
  console.log("═══════════════════════════════════════════════\n");

  for (const agent of AGENTS) {
    console.log(`[${agent.role}] ${agent.address}`);

    const identityId = await mintIdentityIfPossible(
      agent.address,
      agent.uri,
      signer,
      publicClient,
    );

    const idForMimir = identityId ?? 0n;
    console.log(`  Mimir.registerAgent(role="${agent.role}", id=${idForMimir})...`);

    const txHash = (await (signer as any).writeContract({
      address:      mimirAddr,
      abi:          MIMIR_ABI,
      functionName: "registerAgent",
      args:         [agent.address, agent.role, idForMimir],
      chain:        mantleChain,
    })) as Hex;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new Error(`registerAgent reverted for ${agent.role}`);
    console.log(`  ✓ ${getExplorerTxUrl(txHash)}\n`);
  }

  console.log("Done. Agents are now attributable on-chain.");
}

main().catch((err) => {
  console.error("register-agents failed:", err?.message ?? err);
  process.exit(1);
});
