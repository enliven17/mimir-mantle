/**
 * Generate fresh EVM private keys for the Mimir oracle + market-creator agents.
 *
 * Writes ORACLE_PRIVATE_KEY / ORACLE_ADDRESS and MARKET_CREATOR_PRIVATE_KEY /
 * MARKET_CREATOR_ADDRESS into .env.local. Idempotent — refuses to clobber a
 * key that already exists unless --force is passed.
 *
 * Run: npm run agent:wallets
 *      npm run agent:wallets -- --force         (regenerate everything)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ENV_PATH = resolve(process.cwd(), ".env.local");
const FORCE    = process.argv.includes("--force");

interface Wallet {
  keyEnv:  string;
  addrEnv: string;
  label:   string;
}

const WALLETS: Wallet[] = [
  { keyEnv: "ORACLE_PRIVATE_KEY",         addrEnv: "ORACLE_ADDRESS",         label: "oracle"         },
  { keyEnv: "MARKET_CREATOR_PRIVATE_KEY", addrEnv: "MARKET_CREATOR_ADDRESS", label: "market-creator" },
];

function readEnv(): string {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
}

function readVar(raw: string, key: string): string | undefined {
  const m = raw.match(new RegExp(`^${key}=(.+?)$`, "m"));
  return m?.[1]?.trim();
}

function upsert(raw: string, key: string, value: string): string {
  if (new RegExp(`^${key}=`, "m").test(raw)) {
    return raw.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  }
  if (new RegExp(`^#\\s*${key}=`, "m").test(raw)) {
    return raw.replace(new RegExp(`^#\\s*${key}=.*$`, "m"), `${key}=${value}`);
  }
  return raw.endsWith("\n") ? `${raw}${key}=${value}\n` : `${raw}\n${key}=${value}\n`;
}

function main(): void {
  let env = readEnv();

  for (const w of WALLETS) {
    const existing = readVar(env, w.keyEnv);
    if (existing && !FORCE) {
      console.log(`✓ ${w.label.padEnd(15)} already configured (${readVar(env, w.addrEnv) ?? "?"})`);
      continue;
    }

    const priv = generatePrivateKey();
    const addr = privateKeyToAccount(priv).address;

    env = upsert(env, w.keyEnv,  priv);
    env = upsert(env, w.addrEnv, addr);

    console.log(`✚ ${w.label.padEnd(15)} ${addr}`);
  }

  writeFileSync(ENV_PATH, env);

  console.log("");
  console.log("Wallets written to .env.local.");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Fund each address with testnet MNT:");
  console.log("       https://faucet.sepolia.mantle.xyz");
  console.log("  2. Deploy the contract:");
  console.log("       npm run deploy:contract");
  console.log("  3. Start the agents:");
  console.log("       npm run workers");
}

main();
