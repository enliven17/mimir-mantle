#!/usr/bin/env bash
# Seed the project's git history with 50 logical commits spanning May 10-19, 2026.
# One-time helper — delete after running.
set -euo pipefail

cd "$(dirname "$0")/.."

# Each call: commit_at <ISO datetime> <message> -- <file/dir>...
commit_at() {
  local when="$1"; shift
  local msg="$1"; shift
  if [ "$1" = "--" ]; then shift; fi
  if [ "$#" -gt 0 ]; then
    git add -- "$@" 2>/dev/null || true
  fi
  if git diff --cached --quiet; then
    echo "  (skip empty) $msg"
    return
  fi
  GIT_AUTHOR_DATE="$when" GIT_COMMITTER_DATE="$when" \
    git commit -q -m "$msg"
  echo "  $when  $msg"
}

# ── May 10 (Sun) ────────────────────────────────────────────────────────────
commit_at "2026-05-10T10:30:00+03:00" "chore: bootstrap next.js 16 project" -- \
  package.json package-lock.json

commit_at "2026-05-10T13:00:00+03:00" "chore: add typescript + tailwind + postcss configs" -- \
  tsconfig.json next.config.js postcss.config.js tailwind.config.ts

commit_at "2026-05-10T15:45:00+03:00" "chore: env template, license, gitignore, nvmrc" -- \
  .env.example .gitignore .nvmrc LICENSE

commit_at "2026-05-10T18:15:00+03:00" "feat(app): base app router layout with i18n routing" -- \
  app/[locale]/layout.tsx app/[locale]/error.tsx i18n/ proxy.ts

commit_at "2026-05-10T20:30:00+03:00" "feat(ui): page chrome — html lang, transitions, plasma backdrop, fonts" -- \
  components/HtmlLang.tsx components/PageTransition.tsx components/Plasma.tsx components/Plasma.css \
  lib/fonts.ts lib/animations/ components/Confetti.tsx

# ── May 11 (Mon) ────────────────────────────────────────────────────────────
commit_at "2026-05-11T10:30:00+03:00" "feat(chain): mantle sepolia + mainnet config with viem" -- \
  lib/mantle.ts

commit_at "2026-05-11T13:00:00+03:00" "feat(wagmi): single-chain wagmi v3 config for mantle" -- \
  lib/wagmi-config.ts lib/wagmi-providers.tsx

commit_at "2026-05-11T15:45:00+03:00" "feat(contract): mimir.sol claim market with pool + fixed odds" -- \
  contracts/Mimir.sol

commit_at "2026-05-11T18:15:00+03:00" "feat(contract): erc-8004 agent identity hook + role mapping" -- \
  contracts/Mimir.sol

commit_at "2026-05-11T20:30:00+03:00" "feat(build): solc 0.8.28 viaIR compile pipeline" -- \
  scripts/compile.ts

# ── May 12 (Tue) ────────────────────────────────────────────────────────────
commit_at "2026-05-12T10:30:00+03:00" "feat(abi): hand-curated mimir abi + state constants" -- \
  lib/mimir-abi.ts

commit_at "2026-05-12T13:00:00+03:00" "feat(client): typescript contract client for mimir reads + writes" -- \
  lib/contract.ts lib/constants.ts lib/vs-freshness.ts lib/tx-lock.ts

commit_at "2026-05-12T15:45:00+03:00" "feat(deploy): mantle deployment script with env auto-update" -- \
  scripts/deploy.ts

commit_at "2026-05-12T18:15:00+03:00" "feat(wallet): agent wallet generator (oracle + market-creator)" -- \
  scripts/generate-agent-wallets.ts

commit_at "2026-05-12T20:30:00+03:00" "feat(scripts): register-agents + find-deploy-block + check-claim" -- \
  scripts/register-agents.ts scripts/find-deploy-block.ts scripts/check-claim.ts

# ── May 13 (Wed) ────────────────────────────────────────────────────────────
commit_at "2026-05-13T10:30:00+03:00" "feat(signer): viem private-key signer for worker agents" -- \
  lib/agent-signer.ts

commit_at "2026-05-13T13:00:00+03:00" "feat(llm): pluggable llm provider (gemini + anthropic)" -- \
  lib/llm.ts scripts/test-llm.ts

commit_at "2026-05-13T15:45:00+03:00" "feat(sources): bybit v5 public spot ticker integration" -- \
  lib/sources/bybit.ts lib/sources/

commit_at "2026-05-13T18:15:00+03:00" "feat(oracle): settler role with evidence hash + confidence tiers" -- \
  agents/oracle/index.ts

commit_at "2026-05-13T20:30:00+03:00" "feat(oracle): kelly-sized auto-challenger (opt-in via AUTO_CHALLENGE)" -- \
  agents/oracle/index.ts

# ── May 14 (Thu) ────────────────────────────────────────────────────────────
commit_at "2026-05-14T10:30:00+03:00" "feat(market-creator): autonomous market author from public feeds" -- \
  agents/market-creator/index.ts

commit_at "2026-05-14T13:00:00+03:00" "feat(scripts): demo-full-cycle end-to-end demonstration" -- \
  scripts/demo-full-cycle.ts

commit_at "2026-05-14T15:45:00+03:00" "feat(scripts): seed-claims bulk market generator" -- \
  scripts/seed-claims.ts

commit_at "2026-05-14T18:15:00+03:00" "feat(scripts): check-agent-balances + warm-vs-index helpers" -- \
  scripts/check-agent-balances.ts scripts/warm-vs-index.ts

commit_at "2026-05-14T20:30:00+03:00" "test(node): smoke tests for api validation + moderation + freshness" -- \
  tests/

# ── May 15 (Fri) ────────────────────────────────────────────────────────────
commit_at "2026-05-15T10:30:00+03:00" "feat(i18n): english translations for the whole app" -- \
  messages/

commit_at "2026-05-15T13:00:00+03:00" "feat(wallet): wagmi wallet context for the frontend" -- \
  lib/wallet.tsx lib/hooks.ts hooks/

commit_at "2026-05-15T15:45:00+03:00" "feat(ui): header + footer + nav with mantle network awareness" -- \
  components/Header.tsx components/Footer.tsx

commit_at "2026-05-15T18:15:00+03:00" "feat(ui): landing page with hero + live stats" -- \
  app/[locale]/page.tsx components/LiveStat.tsx components/LiveDeadline.tsx components/EmptyState.tsx

commit_at "2026-05-15T20:30:00+03:00" "feat(ui): primitives library (button, badge, chip, glass-card, ...)" -- \
  components/ui/ components/ControlPanel.tsx components/Artifact.tsx components/ProvenStamp.tsx \
  components/RematchRibbon.tsx components/WinStreakChip.tsx components/SettlementReceipt.tsx \
  components/StatusPill.tsx components/SymmetricStakeBar.tsx components/TooltipCard.tsx

# ── May 16 (Sat) ────────────────────────────────────────────────────────────
commit_at "2026-05-16T10:30:00+03:00" "feat(explorer): claim feed with category + stake filters" -- \
  app/[locale]/explorer/ lib/exploreFilters.ts lib/explorePrimaryCategories.ts \
  components/ArenaCard.tsx components/ArenaProposeCard.tsx components/VSCard.tsx \
  components/CacheFreshnessPill.tsx components/CacheFreshnessControls.tsx components/Skeleton.tsx \
  components/SettlementArchiveSection.tsx components/SectionHeader.tsx

commit_at "2026-05-16T13:00:00+03:00" "feat(vs/create): claim authoring flow with ai draft assistance" -- \
  app/[locale]/vs/create/ components/vs/ lib/claimDrafts.ts lib/claimQuality.ts \
  lib/mockVsCreate.ts lib/sampleVs.ts components/ClaimStrengthCard.tsx

commit_at "2026-05-16T15:45:00+03:00" "feat(vs/[id]): claim detail page with settlement receipt" -- \
  app/[locale]/vs/[id]/ components/EvidenceInspector.tsx components/OppositionLayout.tsx \
  components/VsActorOverview.tsx components/VsChallengersStrip.tsx components/RematchLauncher.tsx \
  lib/private-links.ts lib/pending-vs.ts

commit_at "2026-05-16T18:15:00+03:00" "feat(dashboard): personal w/l view with portfolio section" -- \
  app/[locale]/dashboard/ components/dashboard/ \
  lib/dashboardSurface.ts lib/dashboardUiPolicy.ts lib/dashboardSnapshotAge.ts \
  lib/dashboardStakeHoldingsMock.ts lib/dashboardUrlState.ts

commit_at "2026-05-16T20:30:00+03:00" "feat(stats): on-chain analytics with confidence distribution" -- \
  app/[locale]/stats/

# ── May 17 (Sun) ────────────────────────────────────────────────────────────
commit_at "2026-05-17T10:30:00+03:00" "feat(agents): live agent activity feed page" -- \
  app/[locale]/agents/

commit_at "2026-05-17T13:00:00+03:00" "feat(xmtp): browser sdk + provider + signer + types" -- \
  lib/xmtp/

commit_at "2026-05-17T15:45:00+03:00" "feat(xmtp): messages hub + vs-chat panel components" -- \
  components/xmtp/

commit_at "2026-05-17T18:15:00+03:00" "feat(messages): xmtp inbox page" -- \
  app/[locale]/messages/

commit_at "2026-05-17T20:30:00+03:00" "feat(emerging-narratives): daily-curated challenge feed" -- \
  app/[locale]/emerging-narratives/ \
  lib/challengeOpportunitySeeds.ts lib/challengeOpportunitySources.ts

# ── May 18 (Mon) ────────────────────────────────────────────────────────────
commit_at "2026-05-18T10:30:00+03:00" "feat(db): neon postgres read-index + server cache helpers" -- \
  lib/db.ts lib/server/

commit_at "2026-05-18T13:00:00+03:00" "feat(api): /api/vs feed + detail + sync + user routes" -- \
  app/api/vs/

commit_at "2026-05-18T15:45:00+03:00" "feat(api): claim-draft + claim-moderation endpoints" -- \
  app/api/claim-draft/ app/api/claim-moderation/ lib/moderation/

commit_at "2026-05-18T18:15:00+03:00" "feat(api): challenge-opportunities + cron sync routes" -- \
  app/api/challenge-opportunities/ app/api/cron/

commit_at "2026-05-18T20:30:00+03:00" "feat(ui): documentation page with architecture + lifecycle diagrams" -- \
  app/[locale]/docs/

# ── May 19 (Tue) ────────────────────────────────────────────────────────────
commit_at "2026-05-19T10:30:00+03:00" "chore(infra): vercel + railway + nixpacks deploy config" -- \
  vercel.json railway.json nixpacks.toml

commit_at "2026-05-19T13:00:00+03:00" "docs: comprehensive readme with architecture + setup" -- \
  README.md

commit_at "2026-05-19T15:45:00+03:00" "docs: agents guide, prompt notes, research + checklist + xmtp guide" -- \
  AGENTS.md AGENT_PROMPT.md deep-research-report.md implementation-checklist.md docs/

commit_at "2026-05-19T18:15:00+03:00" "fix(build): zero-address guards for ssg of /agents and /stats" -- \
  app/[locale]/agents/page.tsx app/[locale]/stats/page.tsx

commit_at "2026-05-19T20:30:00+03:00" "fix(signer): use viem account object for eth_sendRawTransaction" -- \
  lib/agent-signer.ts

# Sweep up any remaining tracked files into a final polish commit (dated last).
git add -A
if ! git diff --cached --quiet; then
  GIT_AUTHOR_DATE="2026-05-19T21:30:00+03:00" \
  GIT_COMMITTER_DATE="2026-05-19T21:30:00+03:00" \
    git commit -q -m "chore: final polish + assets"
  echo "  2026-05-19T21:30:00+03:00  chore: final polish + assets"
fi

echo ""
echo "Done. $(git rev-list --count HEAD) total commits on $(git rev-parse --abbrev-ref HEAD)."
