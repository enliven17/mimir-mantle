/**
 * Compile contracts/Mimir.sol with solc and emit artifacts.
 *
 * Outputs:
 *   artifacts/Mimir.bin       deploy bytecode
 *   artifacts/Mimir.abi.json  ABI in JSON form
 *
 * Run: npx tsx scripts/compile.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import solc from "solc";

const CONTRACT_PATH = resolve(process.cwd(), "contracts/Mimir.sol");
const ARTIFACTS_DIR = resolve(process.cwd(), "artifacts");
const BIN_OUT       = resolve(ARTIFACTS_DIR, "Mimir.bin");
const ABI_OUT       = resolve(ARTIFACTS_DIR, "Mimir.abi.json");

interface SolcOutput {
  errors?: Array<{ severity: string; formattedMessage: string }>;
  contracts?: Record<
    string,
    Record<string, { evm: { bytecode: { object: string } }; abi: unknown[] }>
  >;
}

function main(): void {
  console.log(`Compiling ${CONTRACT_PATH}…`);
  const source = readFileSync(CONTRACT_PATH, "utf8");

  const input = {
    language: "Solidity",
    sources: { "Mimir.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: { "*": { "*": ["evm.bytecode.object", "abi"] } },
    },
  };

  const output: SolcOutput = JSON.parse(solc.compile(JSON.stringify(input)));
  const fatal = output.errors?.filter((e) => e.severity === "error") ?? [];
  if (fatal.length > 0) {
    fatal.forEach((e) => console.error(e.formattedMessage));
    throw new Error("Solidity compilation failed");
  }
  const warnings = output.errors?.filter((e) => e.severity === "warning") ?? [];
  if (warnings.length > 0) {
    console.log(`  ${warnings.length} warning(s)`);
  }

  const artifact = output.contracts?.["Mimir.sol"]?.Mimir;
  if (!artifact) throw new Error("No Mimir artifact in solc output");

  const bytecode = artifact.evm.bytecode.object;
  const abi      = artifact.abi;

  if (!existsSync(ARTIFACTS_DIR)) mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(BIN_OUT, bytecode);
  writeFileSync(ABI_OUT, JSON.stringify(abi, null, 2));

  console.log(`  bytecode: ${bytecode.length / 2} bytes → artifacts/Mimir.bin`);
  console.log(`  abi:      ${(abi as unknown[]).length} entries → artifacts/Mimir.abi.json`);
}

main();
