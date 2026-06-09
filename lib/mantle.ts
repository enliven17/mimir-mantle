/**
 * Mantle chain configuration.
 *
 * Mantle Sepolia (testnet) — chain id 5003
 *   native currency: MNT (18 decimals)
 *   explorer       : https://explorer.sepolia.mantle.xyz
 *   faucet         : https://faucet.sepolia.mantle.xyz
 *
 * Mantle mainnet — chain id 5000 (only used if NEXT_PUBLIC_MANTLE_MAINNET=1)
 *
 * Mimir stakes use native MNT, settled via msg.value — no ERC-20 approve.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Network constants ─────────────────────────────────────────────────────────
const SEPOLIA_EXPLORER = "https://explorer.sepolia.mantle.xyz";
const MAINNET_EXPLORER = "https://explorer.mantle.xyz";

const SEPOLIA_RPC_DEFAULT = "https://rpc.sepolia.mantle.xyz";
const MAINNET_RPC_DEFAULT = "https://rpc.mantle.xyz";

export const MANTLE_SEPOLIA_ID = 5003;
export const MANTLE_MAINNET_ID = 5000;

// Standard Multicall3 deployment (same address on Mantle Sepolia + mainnet).
// Enables viem's automatic read batching so the feed's hundreds of parallel
// readContract calls collapse into a few aggregate RPC requests instead of
// flooding the public RPC (which drops calls under burst load).
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

const USE_MAINNET = process.env.NEXT_PUBLIC_MANTLE_MAINNET === "1";

// ── Chain definitions ─────────────────────────────────────────────────────────
export const mantleSepolia: Chain = {
  id: MANTLE_SEPOLIA_ID,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [SEPOLIA_RPC_DEFAULT] },
  },
  blockExplorers: {
    default: { name: "Mantle Sepolia Explorer", url: SEPOLIA_EXPLORER },
  },
  contracts: {
    multicall3: { address: MULTICALL3_ADDRESS },
  },
  testnet: true,
};

export const mantleMainnet: Chain = {
  id: MANTLE_MAINNET_ID,
  name: "Mantle",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [MAINNET_RPC_DEFAULT] },
  },
  blockExplorers: {
    default: { name: "Mantle Explorer", url: MAINNET_EXPLORER },
  },
  contracts: {
    multicall3: { address: MULTICALL3_ADDRESS },
  },
  testnet: false,
};

export const mantleChain: Chain = USE_MAINNET ? mantleMainnet : mantleSepolia;

// ── RPC endpoint ──────────────────────────────────────────────────────────────
export function getMantleRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MANTLE_RPC ||
    (typeof window === "undefined" ? process.env.MANTLE_RPC : undefined) ||
    mantleChain.rpcUrls.default.http[0]
  );
}

export function getContractAddress(): `0x${string}` {
  const addr =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0x0000000000000000000000000000000000000000";
  return addr as `0x${string}`;
}

// ── Block-range logs helper ───────────────────────────────────────────────────
// Mantle's public RPC accepts large eth_getLogs ranges, but we still chunk to
// be conservative. Adjust via env if a particular provider is stricter.
export const MANTLE_LOG_CHUNK = BigInt(process.env.MANTLE_LOG_CHUNK ?? "9999");

export function getDeployBlock(): bigint {
  const raw = process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
  if (raw && raw.trim().length > 0) {
    try { return BigInt(raw); } catch { /* fall through */ }
  }
  return 0n;
}

// Mantle's public RPC intermittently fails eth_getLogs under load. Retry each
// chunk with backoff so a single transient failure doesn't blank the /agents
// and /stats event scans. A dedicated RPC (NEXT_PUBLIC_MANTLE_RPC) avoids it.
const LOGS_RETRY_ATTEMPTS = 4;
async function getLogsWithRetry(
  client: PublicClient,
  args: Parameters<PublicClient["getLogs"]>[0],
): Promise<any[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= LOGS_RETRY_ATTEMPTS; attempt++) {
    try {
      return await client.getLogs(args as any);
    } catch (err) {
      lastErr = err;
      if (attempt === LOGS_RETRY_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

export async function paginatedGetLogs(
  client: PublicClient,
  params: Omit<Parameters<PublicClient["getLogs"]>[0], "fromBlock" | "toBlock">,
  fromBlock: bigint,
  toBlock?: bigint,
): Promise<any[]> {
  const end = toBlock ?? (await client.getBlockNumber());
  const all: any[] = [];
  for (let start = fromBlock; start <= end; ) {
    const stop = start + MANTLE_LOG_CHUNK > end ? end : start + MANTLE_LOG_CHUNK;
    const logs = await getLogsWithRetry(client, { ...(params as any), fromBlock: start, toBlock: stop });
    all.push(...logs);
    start = stop + 1n;
  }
  return all;
}

// ── Explorer helpers ──────────────────────────────────────────────────────────
function explorerBase(): string {
  return USE_MAINNET ? MAINNET_EXPLORER : SEPOLIA_EXPLORER;
}

export function getExplorerTxUrl(txHash: string): string {
  return `${explorerBase()}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${explorerBase()}/address/${address}`;
}

// ── viem clients ──────────────────────────────────────────────────────────────
export function createMantlePublicClient(): PublicClient {
  return createPublicClient({
    chain: mantleChain,
    transport: http(getMantleRpcUrl()),
    batch: { multicall: true },
  }) as PublicClient;
}

export function createMantleWalletClient(provider: unknown): WalletClient {
  return createWalletClient({
    chain: mantleChain,
    transport: custom(provider as any),
  });
}

export function createMantleWalletClientWithKey(privateKey: string): WalletClient {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    chain: mantleChain,
    account,
    transport: http(getMantleRpcUrl()),
  });
}

// ── MetaMask chain-switch helper ──────────────────────────────────────────────
export async function ensureMantleChain(ethereum: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}): Promise<void> {
  const chainIdHex = `0x${mantleChain.id.toString(16)}`;
  const currentChainId = (await ethereum.request({ method: "eth_chainId" })) as string;
  if (currentChainId === chainIdHex) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (err: any) {
    if (err?.code !== 4902) throw err;
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: mantleChain.name,
          rpcUrls: mantleChain.rpcUrls.default.http,
          nativeCurrency: mantleChain.nativeCurrency,
          blockExplorerUrls: [explorerBase()],
        },
      ],
    });
  }
}

// ── Unit helpers ──────────────────────────────────────────────────────────────
// MNT has 18 decimals. We keep the same "micro" naming the rest of the app uses,
// but it always represents 1e-6 MNT (i.e. wei / 1e12). Display is 6 sig digits.
export const MNT_DECIMALS = 18;
export const MNT_UNIT = BigInt(10 ** MNT_DECIMALS);

export function mntToWei(amount: number): bigint {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid MNT amount");
  return BigInt(Math.round(amount * 1_000_000)) * BigInt(10 ** 12);
}

export function weiToMnt(wei: bigint | number): number {
  return Number(BigInt(wei) / BigInt(10 ** 12)) / 1_000_000;
}

export function formatMnt(wei: bigint | number, decimals = 2): string {
  return weiToMnt(wei).toFixed(decimals) + " MNT";
}
