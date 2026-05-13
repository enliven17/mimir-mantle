/**
 * Mimir agent signer for Mantle.
 *
 * Each AI agent (oracle, market-creator) owns a local EVM private key. Reads
 * stay on Mantle RPC via viem.publicClient; writes go through a per-role wallet
 * client. There is no custodial / KMS dependency.
 *
 * The exported surface is intentionally drop-in compatible with the old
 * `lib/circle-w3s.ts` helpers — agent code only had to swap the import path:
 *   executeContract({ walletId, contractAddress, abiFunctionSignature,
 *                     abiParameters, amount?, refId? }) → Hex
 *
 * `walletId` is now a role tag ("oracle" | "market-creator"); the helper looks
 * up the corresponding private key from env. `abiFunctionSignature` is parsed
 * to extract the function name, which is matched against MIMIR_ABI.
 *
 * Required env:
 *   ORACLE_PRIVATE_KEY          / ORACLE_ADDRESS
 *   MARKET_CREATOR_PRIVATE_KEY  / MARKET_CREATOR_ADDRESS
 *
 * Generate with: npm run agent:wallets
 */

import {
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  type AbiFunction,
  type AbiParameter,
  type Hex,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  mantleChain,
  getMantleRpcUrl,
  createMantlePublicClient,
} from "./mantle";
import { MIMIR_ABI } from "./mimir-abi";

export type AgentRole = "oracle" | "market-creator";

// ── Env lookups ──────────────────────────────────────────────────────────────
function requireEnv(key: string): string {
  const v = process.env[key]?.trim();
  if (!v) throw new Error(`${key} env var is required`);
  return v;
}

function getRoleConfig(role: AgentRole): { privateKey: `0x${string}`; address: `0x${string}` } {
  if (role === "oracle") {
    return {
      privateKey: requireEnv("ORACLE_PRIVATE_KEY") as `0x${string}`,
      address:    requireEnv("ORACLE_ADDRESS")     as `0x${string}`,
    };
  }
  if (role === "market-creator") {
    return {
      privateKey: requireEnv("MARKET_CREATOR_PRIVATE_KEY") as `0x${string}`,
      address:    requireEnv("MARKET_CREATOR_ADDRESS")     as `0x${string}`,
    };
  }
  throw new Error(`Unknown agent role: ${role}`);
}

function isAgentRole(s: string): s is AgentRole {
  return s === "oracle" || s === "market-creator";
}

// ── Wallet client cache ──────────────────────────────────────────────────────
// We cache the local PrivateKeyAccount (not just the address string). viem
// routes through eth_sendRawTransaction when given a local Account, and through
// eth_sendTransaction when given just an address string — the public Mantle
// Sepolia RPC blocks the latter as "method not whitelisted".
const _walletClients = new Map<AgentRole, { client: WalletClient; account: PrivateKeyAccount }>();

function walletClientFor(role: AgentRole): { client: WalletClient; account: PrivateKeyAccount } {
  const cached = _walletClients.get(role);
  if (cached) return cached;
  const { privateKey } = getRoleConfig(role);
  const account = privateKeyToAccount(privateKey);
  const client  = createWalletClient({
    chain:     mantleChain,
    transport: http(getMantleRpcUrl()),
    account,
  });
  const entry = { client, account };
  _walletClients.set(role, entry);
  return entry;
}

// ── executeContract: drop-in replacement for the old W3S helper ──────────────
export interface ExecuteContractArgs {
  /** Role tag — "oracle" or "market-creator". Maps to a configured private key. */
  walletId: string;
  contractAddress: `0x${string}`;
  /** e.g. "resolveClaim(uint256,uint8,string,uint8,bytes32)". Only the name is used. */
  abiFunctionSignature: string;
  /** Args in the order declared by the ABI. BigInt / number / string accepted. */
  abiParameters: unknown[];
  /** Decimal MNT amount attached as msg.value, e.g. "2.5". */
  amount?: string;
  /** Ignored — kept for source compatibility. */
  refId?: string;
}

/**
 * Submit a contract write as the named agent and wait for the receipt.
 * Returns the tx hash. Throws on revert / unknown role / missing function.
 */
export async function executeContract(args: ExecuteContractArgs): Promise<Hex> {
  if (!isAgentRole(args.walletId)) {
    throw new Error(`executeContract: unknown role "${args.walletId}"`);
  }
  const role = args.walletId;

  // Parse function name out of the signature ("resolveClaim(uint256,…)" → "resolveClaim")
  const fnName = args.abiFunctionSignature.split("(")[0].trim();

  // Coerce inputs back to viem-native types based on the ABI declaration.
  const fnAbi = MIMIR_ABI.find(
    (item) => item.type === "function" && item.name === fnName,
  ) as AbiFunction | undefined;
  if (!fnAbi) throw new Error(`Function ${fnName} not found in MIMIR_ABI`);

  const coercedArgs = coerceArgs(args.abiParameters, fnAbi.inputs as AbiParameter[]);
  const value = args.amount ? parseEther(args.amount) : 0n;

  const { client, account } = walletClientFor(role);

  const txHash = await client.writeContract({
    address:      args.contractAddress,
    abi:          MIMIR_ABI,
    functionName: fnName as any,
    args:         coercedArgs as any,
    value,
    account,
    chain:        mantleChain,
  });

  const publicClient = createMantlePublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`Tx ${txHash} reverted`);
  return txHash;
}

// ── Generic contract write helper (use with any ABI) ─────────────────────────
export interface ExecuteContractGenericArgs {
  role: AgentRole;
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: unknown[];
  /** Decimal native amount attached as msg.value, e.g. "2.5". */
  amount?: string;
}

/**
 * Generic write helper for ABIs other than MIMIR_ABI (e.g. ERC-8004 registry).
 */
export async function executeContractGeneric(
  cfg: ExecuteContractGenericArgs,
): Promise<Hex> {
  const value = cfg.amount ? parseEther(cfg.amount) : 0n;
  const { client, account } = walletClientFor(cfg.role);

  const txHash = await client.writeContract({
    address:      cfg.contractAddress,
    abi:          cfg.abi as any,
    functionName: cfg.functionName as any,
    args:         cfg.args as any,
    value,
    account,
    chain:        mantleChain,
  });

  const publicClient = createMantlePublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`Tx ${txHash} reverted`);
  return txHash;
}

// ── Native MNT transfer ──────────────────────────────────────────────────────
export interface TransferNativeArgs {
  /** Role tag — kept for back-compat with the old transferNative shape. */
  walletId:           string;
  destinationAddress: `0x${string}`;
  /** Ignored — chain comes from mantleChain. */
  blockchain?:        string;
  amount:             string;     // decimal MNT
  refId?:             string;
}

export async function transferNative(args: TransferNativeArgs): Promise<Hex> {
  if (!isAgentRole(args.walletId)) {
    throw new Error(`transferNative: unknown role "${args.walletId}"`);
  }
  const role = args.walletId;
  const { client, account } = walletClientFor(role);

  const txHash = await client.sendTransaction({
    to:      args.destinationAddress,
    value:   parseEther(args.amount),
    account,
    chain:   mantleChain,
  });
  const publicClient = createMantlePublicClient();
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ── Type coercion: stringified args → viem-native (bigint / string / etc) ───
function coerceArgs(args: readonly unknown[], inputs: AbiParameter[]): unknown[] {
  return args.map((a, i) => {
    const t = inputs[i]?.type ?? "";
    if (t.startsWith("uint") || t.startsWith("int")) {
      return typeof a === "bigint" ? a : BigInt(a as any);
    }
    if (t === "bool")     return Boolean(a);
    if (t === "address")  return a as `0x${string}`;
    return a;
  });
}

// ── Back-compat helpers ──────────────────────────────────────────────────────

/** @deprecated old W3S surface — kept so agent code stays unchanged. */
export function buildAbiFunctionSignature(
  fnName: string,
  abi: ReadonlyArray<unknown>,
): string {
  const fn = abi.find(
    (item): item is AbiFunction =>
      typeof item === "object" && item !== null &&
      (item as AbiFunction).type === "function" &&
      (item as AbiFunction).name === fnName,
  );
  if (!fn) throw new Error(`Function ${fnName} not found in ABI`);
  const types = (fn.inputs as AbiParameter[]).map((i) => i.type).join(",");
  return `${fnName}(${types})`;
}

/**
 * Identity helper kept so call sites spell out "these are the ABI parameters".
 * The signer coerces stringified bigints / numbers internally based on the
 * ABI input types, so callers can pass plain JS values.
 */
export function toAbiParameters(args: readonly unknown[]): unknown[] {
  return args.slice();
}

// ── Role helpers (same names as the old W3S module) ──────────────────────────
export function getOracleWalletId(): AgentRole { return "oracle"; }

export function getOracleAddress(): `0x${string}` {
  return getRoleConfig("oracle").address;
}

export function getMarketCreatorWalletId(): AgentRole { return "market-creator"; }

export function getMarketCreatorAddress(): `0x${string}` {
  return getRoleConfig("market-creator").address;
}
