/**
 * Server-side helpers for resolving on-chain addresses to council personas.
 *
 * Pages like /council and /vs/[id] need to map a raw address to a persona
 * spec (emoji, displayName, accent colors) so the UI can show e.g.
 * "🌞 The Optimist" instead of "0x3e5e…ffac".
 *
 * Lookups are address-keyed and case-insensitive. The map is built once per
 * process from the COUNCIL_<SLUG>_ADDRESS env vars.
 */

import "server-only";
import {
  COUNCIL_PERSONAS,
  personaAddressEnv,
  type PersonaSpec,
} from "../agents/council/personas";

let cachedPersonaByAddress: Map<string, PersonaSpec> | null = null;

function buildPersonaIndex(): Map<string, PersonaSpec> {
  const map = new Map<string, PersonaSpec>();
  for (const p of COUNCIL_PERSONAS) {
    const addr = process.env[personaAddressEnv(p)]?.toLowerCase();
    if (addr) map.set(addr, p);
  }
  return map;
}

export function getCouncilPersonaIndex(): Map<string, PersonaSpec> {
  if (!cachedPersonaByAddress) {
    cachedPersonaByAddress = buildPersonaIndex();
  }
  return cachedPersonaByAddress;
}

/**
 * Returns every persona whose wallet env vars are wired in the current
 * deploy. Used by /council to render persona cards even when a persona
 * has zero on-chain activity yet.
 */
export function getActiveCouncilPersonas(): Array<{
  persona: PersonaSpec;
  address: string;
}> {
  const out: Array<{ persona: PersonaSpec; address: string }> = [];
  for (const p of COUNCIL_PERSONAS) {
    const addr = process.env[personaAddressEnv(p)];
    if (addr) out.push({ persona: p, address: addr });
  }
  return out;
}

/** Map an address to its persona spec, or null if it's not a council member. */
export function getPersonaForAddress(address: string): PersonaSpec | null {
  return getCouncilPersonaIndex().get(address.toLowerCase()) ?? null;
}
