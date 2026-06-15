/**
 * Generate fresh local EVM keys for the 10 Mimir Council personas.
 *
 * Writes COUNCIL_<SLUG>_PRIVATE_KEY / COUNCIL_<SLUG>_ADDRESS into .env.local
 * for every persona in the roster. Idempotent — refuses to clobber a key that
 * already exists unless --force is passed.
 *
 * Run: npm run council:wallets
 *      npm run council:wallets -- --force      (regenerate everything)
 *
 * After running, fund each printed address with testnet MNT:
 *   https://faucet.sepolia.mantle.xyz
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  COUNCIL_PERSONAS,
  personaPrivateKeyEnv,
  personaAddressEnv,
} from "../agents/council/personas";

const ENV_PATH = resolve(process.cwd(), ".env.local");
const FORCE    = process.argv.includes("--force");

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
  const created: string[] = [];

  for (const p of COUNCIL_PERSONAS) {
    const keyEnv  = personaPrivateKeyEnv(p);
    const addrEnv = personaAddressEnv(p);
    const existing = readVar(env, keyEnv);

    if (existing && !FORCE) {
      console.log(`✓ ${p.emoji} ${p.displayName.padEnd(22)} already configured (${readVar(env, addrEnv) ?? "?"})`);
      continue;
    }

    const priv = generatePrivateKey();
    const addr = privateKeyToAccount(priv).address;

    env = upsert(env, keyEnv, priv);
    env = upsert(env, addrEnv, addr);
    created.push(addr);

    console.log(`✚ ${p.emoji} ${p.displayName.padEnd(22)} ${addr}`);
  }

  writeFileSync(ENV_PATH, env);

  console.log("");
  console.log(`Council wallets written to .env.local (${created.length} new).`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Fund each address with testnet MNT (≥ ~6 MNT each for a few stakes):");
  console.log("       https://faucet.sepolia.mantle.xyz");
  console.log("  2. Start the council:");
  console.log("       npm run council        (standalone)");
  console.log("       npm run workers        (alongside oracle + market-creator)");
}

main();
