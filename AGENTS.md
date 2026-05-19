# AGENTS.md — Mimir

This repository contains Mimir, an AI-settled claim market on Mantle.

## Repository layout

| Path | Purpose |
|------|---------|
| `contracts/Mimir.sol` | Solidity smart contract (EVM, Mantle) |
| `artifacts/Mimir.bin` + `Mimir.abi.json` | Compiled bytecode + ABI (from `npm run compile:contract`) |
| `lib/mimir-abi.ts` | Hand-curated ABI + state constants for Mimir.sol |
| `lib/mantle.ts` | Mantle chain config (viem, chain 5003 Sepolia / 5000 mainnet) |
| `lib/contract.ts` | TypeScript contract client (read + write) |
| `lib/wallet.tsx` | Wallet context (frontend, wagmi/viem) |
| `lib/wagmi-config.ts` | wagmi config — Mantle only |
| `lib/agent-signer.ts` | Local EVM private-key signer used by the worker agents |
| `lib/sources/bybit.ts` | Bybit V5 public spot-ticker helpers |
| `agents/oracle/index.ts` | Off-chain AI oracle agent (LLM + viem signer) |
| `agents/market-creator/index.ts` | Autonomous market creator (LLM + viem signer + Bybit) |
| `scripts/compile.ts` | solc 0.8.28 viaIR compile pipeline |
| `scripts/deploy.ts` | Mantle deployment script |
| `scripts/generate-agent-wallets.ts` | Mint fresh oracle + market-creator keys |
| `scripts/register-agents.ts` | ERC-8004 mint + `Mimir.registerAgent` mirror |
| `scripts/demo-full-cycle.ts` | Create → challenge → settle end-to-end demo |
| `scripts/seed-claims.ts` | Bulk-seed demo markets |
| `messages/en.json` | next-intl translation source |

Back-compat shims: `lib/arc.ts` re-exports from `lib/mantle`; `lib/circle-w3s.ts`
re-exports from `lib/agent-signer`. New code should import the Mantle names
directly. The shims exist only so any stale import paths still resolve.

## Key rules

- Contract state is the source of truth. Neon Postgres is a read-index cache only.
- MNT is the **native currency** on Mantle. Stakes use `msg.value` — no ERC-20 approval needed.
- Resolution is oracle-only. `resolveClaim()` can only be called by the `oracle` address set in the contract. Do not expose user-triggered resolution.
- Agents (oracle, market-creator) sign via `lib/agent-signer.ts` using local EVM private keys. There is no custodial layer; each agent owns its key.
- When `Mimir.sol` changes, re-run `npm run compile:contract` and keep `lib/mimir-abi.ts` in sync. The agent signer derives function names from `abiFunctionSignature` and matches against `MIMIR_ABI` at runtime, so ABI completeness matters for both reads (viem) and writes.
- MNT has 18 decimals at the EVM level; UI displays 6 significant decimals.
- Categories: `sports`, `weather`, `crypto`, `culture`, `custom` (English).

## Oracle agent

```bash
# Start the oracle (needs ORACLE_PRIVATE_KEY + GEMINI_API_KEY or ANTHROPIC_API_KEY)
npm run oracle
# Enable economic auto-challenges:
AUTO_CHALLENGE=1 npm run oracle
```

The oracle polls for active claims past their deadline every 60 seconds, fetches evidence, calls the configured LLM to evaluate, and sends `resolveClaim()` to Mantle.

## Deploy

```bash
# 1. Generate agent keys, fund both addresses, then:
npm run compile:contract       # solc 0.8.28 viaIR → artifacts/Mimir.bin + .abi.json
npm run deploy:contract        # deploy + write NEXT_PUBLIC_CONTRACT_ADDRESS
npm run agent:register         # ERC-8004 + Mimir.registerAgent
```

`scripts/deploy.ts` uses `DEPLOYER_PRIVATE_KEY` (defaults to reusing the market-creator key) and transfers ownership to `MARKET_CREATOR_ADDRESS` after deploy.
