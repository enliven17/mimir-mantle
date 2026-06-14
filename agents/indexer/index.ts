/**
 * Mimir Indexer — keeps the Neon read-index + challenge-opportunities feed warm.
 *
 * On Railway there is no Vercel cron, so this long-lived process replaces the
 * `/api/cron/sync` + `/api/cron/challenge-opportunities` schedules:
 *   - reconcileVsIndex()              every SYNC_INTERVAL_MS  (default 5 min)
 *   - refreshChallengeOpportunities() every OPP_INTERVAL_MS   (default 6 h)
 *
 * Both are best-effort: a failure is logged and retried next tick, never
 * crashing the process (it runs alongside the web + agent workers).
 *
 * Run: npx tsx agents/indexer/index.ts
 * Env: DATABASE_URL (required for the index), GEMINI_API_KEY / ANTHROPIC_API_KEY
 *      + NEXT_PUBLIC_FEATURE_SOURCE_DRAFTS=1 for the opportunities feed.
 */

import { reconcileVsIndex } from "../../lib/server/vs-index";
import { refreshChallengeOpportunitiesIndex } from "../../lib/server/challenge-opportunities";

const SYNC_INTERVAL_MS = Number(process.env.INDEXER_SYNC_INTERVAL_MS ?? 5 * 60_000);
const OPP_INTERVAL_MS = Number(process.env.INDEXER_OPP_INTERVAL_MS ?? 6 * 60 * 60_000);

const DB_CONFIGURED = Boolean(process.env.DATABASE_URL?.trim());
const OPPS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_SOURCE_DRAFTS === "1";

async function syncIndex(): Promise<void> {
  try {
    const summary = await reconcileVsIndex();
    console.log(
      `[indexer] sync ok — synced=${summary.synced} new=${summary.new} stateChanges=${summary.stateChanges}`,
    );
  } catch (err) {
    console.warn("[indexer] sync failed (will retry next tick):", (err as Error)?.message ?? err);
  }
}

async function syncOpportunities(): Promise<void> {
  try {
    const summary = await refreshChallengeOpportunitiesIndex({ locales: ["en"] });
    console.log(`[indexer] opportunities ok — ${JSON.stringify(summary.countsByLocale)}`);
  } catch (err) {
    console.warn("[indexer] opportunities failed (will retry next tick):", (err as Error)?.message ?? err);
  }
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log("  Mimir Indexer (Railway — Vercel-cron replacement)");
  console.log(`  DB configured     : ${DB_CONFIGURED}`);
  console.log(`  Opportunities feed: ${OPPS_ENABLED ? "ON" : "OFF (NEXT_PUBLIC_FEATURE_SOURCE_DRAFTS!=1)"}`);
  console.log(`  Sync every        : ${(SYNC_INTERVAL_MS / 60_000).toFixed(1)} min`);
  console.log(`  Opportunities every: ${(OPP_INTERVAL_MS / 3_600_000).toFixed(1)} h`);
  console.log("═══════════════════════════════════════════════\n");

  if (!DB_CONFIGURED) {
    console.warn("[indexer] DATABASE_URL not set — index sync disabled, exiting idle loop.");
    return;
  }

  await syncIndex();
  setInterval(syncIndex, SYNC_INTERVAL_MS);

  if (OPPS_ENABLED) {
    await syncOpportunities();
    setInterval(syncOpportunities, OPP_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("[indexer] Fatal:", err);
  process.exit(1);
});
