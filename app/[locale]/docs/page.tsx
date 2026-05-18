"use client";

import { Link } from "@/i18n/navigation";

/* ───────────────────────────────────────────────────────────────────────────
 * Inline SVG diagrams — hand-drawn in the project's blush palette so they
 * inherit the visual language without pulling in Mermaid. Each one is
 * responsive via `viewBox`; tweak only the box/text positions when copy
 * changes.
 *
 * Palette tokens used here mirror tailwind.config.ts > theme.extend.colors.pv.
 * ───────────────────────────────────────────────────────────────────────── */

const C = {
  bg:      "#FCF8F8",
  surface: "#FBEFEF",
  surf2:   "#F9DFDF",
  border:  "#F5AFAF",
  text:    "#2A1818",
  muted:   "#7A5050",
  accent:  "#D85F5F",
};

/* ── 1. Architecture diagram ─────────────────────────────────────────────── */
function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 880 360" className="h-auto w-full" role="img" aria-label="Mimir architecture diagram">
      <defs>
        <marker id="arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill={C.accent} />
        </marker>
      </defs>

      {/* Users */}
      <g>
        <rect x="20" y="150" width="130" height="64" rx="14" fill={C.surface} stroke={C.border} strokeWidth="1.5" />
        <text x="85" y="178" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.text}>Users</text>
        <text x="85" y="196" textAnchor="middle" fontSize="10" fill={C.muted}>MetaMask / Coinbase</text>
      </g>

      {/* Frontend (Vercel) */}
      <g>
        <rect x="210" y="40" width="220" height="120" rx="16" fill={C.surface} stroke={C.border} strokeWidth="1.5" />
        <text x="320" y="68" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">VERCEL · FRONTEND</text>
        <text x="320" y="96" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.text}>Next.js 16 app</text>
        <text x="320" y="118" textAnchor="middle" fontSize="11" fill={C.muted}>/explorer · /vs/[id] · /agents</text>
        <text x="320" y="138" textAnchor="middle" fontSize="11" fill={C.muted}>+ /api routes</text>
      </g>

      {/* Workers (Railway) */}
      <g>
        <rect x="210" y="200" width="220" height="120" rx="16" fill={C.surface} stroke={C.border} strokeWidth="1.5" />
        <text x="320" y="228" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">RAILWAY · WORKERS</text>
        <text x="320" y="256" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.text}>oracle + market-creator</text>
        <text x="320" y="278" textAnchor="middle" fontSize="11" fill={C.muted}>poll, evaluate, settle</text>
        <text x="320" y="298" textAnchor="middle" fontSize="11" fill={C.muted}>local key signer (viem)</text>
      </g>

      {/* Mantle */}
      <g>
        <rect x="490" y="40" width="200" height="120" rx="16" fill={C.surf2} stroke={C.accent} strokeWidth="1.8" />
        <text x="590" y="68" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.accent} letterSpacing="2">MANTLE SEPOLIA</text>
        <text x="590" y="96" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.text}>Mimir.sol</text>
        <text x="590" y="118" textAnchor="middle" fontSize="11" fill={C.muted}>native MNT stakes</text>
        <text x="590" y="138" textAnchor="middle" fontSize="11" fill={C.muted}>chain id 5003</text>
      </g>

      {/* Neon + LLM */}
      <g>
        <rect x="490" y="200" width="200" height="55" rx="12" fill={C.surface} stroke={C.border} strokeWidth="1.5" />
        <text x="590" y="222" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">NEON POSTGRES</text>
        <text x="590" y="240" textAnchor="middle" fontSize="11" fill={C.text}>read-index cache</text>
        <rect x="490" y="265" width="200" height="55" rx="12" fill={C.surface} stroke={C.border} strokeWidth="1.5" />
        <text x="590" y="287" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">LLM PROVIDER</text>
        <text x="590" y="305" textAnchor="middle" fontSize="11" fill={C.text}>Gemini · Anthropic</text>
      </g>

      {/* External callout: ERC-8004 + Bybit */}
      <g>
        <rect x="730" y="100" width="130" height="160" rx="14" fill={C.bg} stroke={C.border} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="795" y="124" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">EXTERNAL</text>
        <text x="795" y="150" textAnchor="middle" fontSize="11" fill={C.text}>ERC-8004</text>
        <text x="795" y="168" textAnchor="middle" fontSize="10" fill={C.muted}>identity registry</text>
        <text x="795" y="196" textAnchor="middle" fontSize="11" fill={C.text}>Bybit V5</text>
        <text x="795" y="214" textAnchor="middle" fontSize="10" fill={C.muted}>spot tickers</text>
        <text x="795" y="240" textAnchor="middle" fontSize="11" fill={C.text}>XMTP</text>
        <text x="795" y="258" textAnchor="middle" fontSize="10" fill={C.muted}>E2E chat (opt)</text>
      </g>

      {/* Arrows */}
      <line x1="150" y1="182" x2="208" y2="100" stroke={C.accent} strokeWidth="1.5" markerEnd="url(#arrow-a)" />
      <line x1="150" y1="182" x2="208" y2="260" stroke={C.accent} strokeWidth="1.5" markerEnd="url(#arrow-a)" />
      <line x1="430" y1="100" x2="488" y2="100" stroke={C.accent} strokeWidth="1.5" markerEnd="url(#arrow-a)" />
      <line x1="430" y1="260" x2="488" y2="100" stroke={C.accent} strokeWidth="1.5" markerEnd="url(#arrow-a)" />
      <line x1="430" y1="260" x2="488" y2="230" stroke={C.accent} strokeWidth="1.5" markerEnd="url(#arrow-a)" />
      <line x1="430" y1="280" x2="488" y2="293" stroke={C.accent} strokeWidth="1.5" markerEnd="url(#arrow-a)" />
      <line x1="690" y1="100" x2="728" y2="150" stroke={C.accent} strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

/* ── 2. Claim lifecycle (horizontal stepper) ─────────────────────────────── */
function LifecycleDiagram() {
  const steps = [
    { tag: "01", title: "Create",   note: "Stake side A in MNT" },
    { tag: "02", title: "Challenge",note: "Side B stakes the other side" },
    { tag: "03", title: "Wait",     note: "Deadline passes" },
    { tag: "04", title: "Read",     note: "Oracle fetches evidence" },
    { tag: "05", title: "Evaluate", note: "LLM returns verdict + confidence" },
    { tag: "06", title: "Resolve",  note: "Atomic on-chain payout" },
  ];
  const W = 1100;
  const H = 220;
  const padX = 60;
  const innerW = W - padX * 2;
  const stepW = innerW / steps.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Claim lifecycle">
      <line x1={padX} y1={H / 2} x2={W - padX} y2={H / 2} stroke={C.border} strokeWidth="2" />

      {steps.map((step, i) => {
        const cx = padX + stepW * i + stepW / 2;
        return (
          <g key={step.tag}>
            <circle cx={cx} cy={H / 2} r="14" fill={C.bg} stroke={C.accent} strokeWidth="2" />
            <text x={cx} y={H / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.accent}>{step.tag}</text>
            <text x={cx} y={H / 2 - 36} textAnchor="middle" fontSize="14" fontWeight="700" fill={C.text}>{step.title}</text>
            <text x={cx} y={H / 2 + 50} textAnchor="middle" fontSize="11" fill={C.muted}>{step.note}</text>
          </g>
        );
      })}

      <text x={padX} y={H / 2 - 60} fontSize="10" fontWeight="700" letterSpacing="2" fill={C.muted}>CREATOR</text>
      <text x={W - padX} y={H / 2 - 60} fontSize="10" fontWeight="700" letterSpacing="2" textAnchor="end" fill={C.muted}>ORACLE</text>
    </svg>
  );
}

/* ── 3. Agent decision tree ──────────────────────────────────────────────── */
function AgentLoopDiagram() {
  return (
    <svg viewBox="0 0 880 320" className="h-auto w-full" role="img" aria-label="Oracle agent decision tree">
      <defs>
        <marker id="arrow-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill={C.accent} />
        </marker>
      </defs>

      {/* Poll */}
      <g>
        <ellipse cx="120" cy="160" rx="80" ry="40" fill={C.surf2} stroke={C.accent} strokeWidth="1.8" />
        <text x="120" y="156" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.text}>Poll loop</text>
        <text x="120" y="174" textAnchor="middle" fontSize="11" fill={C.muted}>every 60s</text>
      </g>

      {/* Branch */}
      <g>
        <rect x="280" y="50" width="180" height="60" rx="14" fill={C.surface} stroke={C.border} strokeWidth="1.6" />
        <text x="370" y="76" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.text}>SETTLER</text>
        <text x="370" y="94" textAnchor="middle" fontSize="11" fill={C.muted}>ACTIVE + deadline passed</text>

        <rect x="280" y="210" width="180" height="60" rx="14" fill={C.surface} stroke={C.border} strokeWidth="1.6" />
        <text x="370" y="236" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.text}>CHALLENGER</text>
        <text x="370" y="254" textAnchor="middle" fontSize="11" fill={C.muted}>OPEN + AUTO_CHALLENGE=1</text>
      </g>

      {/* Right column: outcomes */}
      <g>
        <rect x="540" y="20" width="320" height="120" rx="14" fill={C.bg} stroke={C.border} strokeWidth="1.6" />
        <text x="700" y="46" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">SETTLE PATH</text>
        <text x="700" y="72" textAnchor="middle" fontSize="12" fill={C.text}>fetchEvidence(URL)</text>
        <text x="700" y="92" textAnchor="middle" fontSize="12" fill={C.text}>askLLM(prompt) → verdict + conf</text>
        <text x="700" y="112" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.accent}>resolveClaim(...)</text>

        <rect x="540" y="180" width="320" height="120" rx="14" fill={C.bg} stroke={C.border} strokeWidth="1.6" />
        <text x="700" y="206" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">CHALLENGE PATH</text>
        <text x="700" y="232" textAnchor="middle" fontSize="12" fill={C.text}>evaluate early (LLM)</text>
        <text x="700" y="252" textAnchor="middle" fontSize="12" fill={C.text}>only if conf ≥ 80%</text>
        <text x="700" y="272" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.accent}>Kelly-sized challengeClaim(...)</text>
      </g>

      {/* Arrows */}
      <line x1="200" y1="150" x2="278" y2="80" stroke={C.accent} strokeWidth="1.6" markerEnd="url(#arrow-b)" />
      <line x1="200" y1="170" x2="278" y2="240" stroke={C.accent} strokeWidth="1.6" markerEnd="url(#arrow-b)" />
      <line x1="460" y1="80"  x2="538" y2="80"  stroke={C.accent} strokeWidth="1.6" markerEnd="url(#arrow-b)" />
      <line x1="460" y1="240" x2="538" y2="240" stroke={C.accent} strokeWidth="1.6" markerEnd="url(#arrow-b)" />
    </svg>
  );
}

/* ── 4. ERC-8004 identity flow ───────────────────────────────────────────── */
function IdentityDiagram() {
  return (
    <svg viewBox="0 0 940 240" className="h-auto w-full" role="img" aria-label="ERC-8004 agent identity flow">
      <defs>
        <marker id="arrow-i" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill={C.accent} />
        </marker>
      </defs>

      {/* Agent wallet */}
      <g>
        <rect x="20" y="60" width="220" height="120" rx="16" fill={C.surface} stroke={C.border} strokeWidth="1.6" />
        <text x="130" y="86" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">AGENT WALLET</text>
        <text x="130" y="110" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.text}>oracle · market-creator</text>
        <text x="130" y="138" textAnchor="middle" fontSize="11" fill={C.muted}>local EVM key</text>
        <text x="130" y="156" textAnchor="middle" fontSize="11" fill={C.muted}>holds MNT, signs tx</text>
      </g>

      {/* ERC-8004 Identity Registry */}
      <g>
        <rect x="370" y="60" width="200" height="120" rx="16" fill={C.surf2} stroke={C.accent} strokeWidth="1.8" />
        <text x="470" y="86" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.accent} letterSpacing="2">ERC-8004</text>
        <text x="470" y="110" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.text}>IdentityRegistry</text>
        <text x="470" y="138" textAnchor="middle" fontSize="11" fill={C.muted}>register(owner, agentURI)</text>
        <text x="470" y="156" textAnchor="middle" fontSize="11" fill={C.muted}>→ agentId NFT</text>
      </g>

      {/* Mimir mirror */}
      <g>
        <rect x="700" y="60" width="220" height="120" rx="16" fill={C.surface} stroke={C.border} strokeWidth="1.6" />
        <text x="810" y="86" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted} letterSpacing="2">MIMIR.SOL</text>
        <text x="810" y="110" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.text}>registerAgent(...)</text>
        <text x="810" y="138" textAnchor="middle" fontSize="11" fill={C.muted}>agentRole[wallet]</text>
        <text x="810" y="156" textAnchor="middle" fontSize="11" fill={C.muted}>agentIdentityId[wallet]</text>
      </g>

      <line x1="240" y1="120" x2="368" y2="120" stroke={C.accent} strokeWidth="1.6" markerEnd="url(#arrow-i)" />
      <line x1="570" y1="120" x2="698" y2="120" stroke={C.accent} strokeWidth="1.6" markerEnd="url(#arrow-i)" />

      <text x="304" y="108" textAnchor="middle" fontSize="11" fontWeight="600" fill={C.muted}>1. mint</text>
      <text x="634" y="108" textAnchor="middle" fontSize="11" fontWeight="600" fill={C.muted}>2. mirror tokenId</text>
    </svg>
  );
}

/* ── Section primitives ──────────────────────────────────────────────────── */
function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-6">
      <header className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-pv-emerald">{eyebrow}</p>
        <h2 className="text-2xl font-bold tracking-tight text-pv-text sm:text-3xl">{title}</h2>
      </header>
      <div className="space-y-5 text-[15px] leading-relaxed text-pv-text/85">{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-pv-border/40 bg-pv-surface/70 p-5">
      <h3 className="mb-2 font-bold tracking-tight text-pv-text">{title}</h3>
      <div className="text-sm leading-relaxed text-pv-text/80">{children}</div>
    </div>
  );
}

function DiagramFrame({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="my-4 rounded-2xl border border-pv-border/40 bg-pv-surface/40 p-5 sm:p-7">
      <div className="overflow-x-auto">{children}</div>
      <figcaption className="mt-3 text-center text-xs text-pv-muted">{caption}</figcaption>
    </figure>
  );
}

function TocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block border-l-2 border-pv-border/40 py-1 pl-3 text-sm text-pv-text/80 transition-colors hover:border-pv-emerald hover:text-pv-text"
    >
      {label}
    </a>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function DocsPage() {
  return (
    <article className="mx-auto max-w-4xl space-y-14 py-12">
      <header className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-pv-emerald">
          MIMIR · DOCUMENTATION
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-pv-text sm:text-5xl">
          How Mimir works
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-pv-text/75 sm:text-lg">
          Mimir is an AI-settled claim market on Mantle. Two parties stake native
          MNT on opposite sides of a verifiable question; when the deadline passes,
          an off-chain AI oracle reads the agreed-upon evidence source, returns a
          verdict, and the smart contract pays out the winning side atomically.
          No committees, no manual disputes.
        </p>
      </header>

      {/* TOC */}
      <nav aria-label="Table of contents" className="rounded-2xl border border-pv-border/30 bg-pv-surface/40 p-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-pv-muted">Contents</p>
        <div className="grid gap-1 sm:grid-cols-2">
          <TocLink href="#what" label="1. What Mimir is" />
          <TocLink href="#why-mantle" label="2. Why MNT on Mantle" />
          <TocLink href="#architecture" label="3. Architecture" />
          <TocLink href="#lifecycle" label="4. The claim lifecycle" />
          <TocLink href="#agents" label="5. The agents" />
          <TocLink href="#identity" label="6. ERC-8004 agent identity" />
          <TocLink href="#contract" label="7. Smart contract terms" />
          <TocLink href="#play" label="8. How to play" />
          <TocLink href="#faq" label="9. FAQ" />
        </div>
      </nav>

      <Section id="what" eyebrow="01" title="What Mimir is">
        <p>
          A claim in Mimir is a single, verifiable question with a deadline and a
          designated resolution source — for example,{" "}
          <em>&ldquo;Will the Bybit BTC/USDT spot price close above $100,000 on 2026-06-15?&rdquo;</em>
        </p>
        <p>
          Anyone creates a claim by staking MNT on one side. Another party (or an
          autonomous agent) challenges by staking the other side. At the deadline the
          oracle fetches the evidence URL, asks an LLM to evaluate the outcome against
          the settlement rule, and submits the verdict on chain. The contract pays out
          the winning side in the same transaction.
        </p>
        <p>
          What ships on chain: the question, both positions, the resolution URL, both
          stakes, the verdict, the confidence number, and the{" "}
          <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">keccak256</code>{" "}
          hash of the raw evidence the oracle actually saw. The hash means anyone can
          re-fetch the URL, hash it themselves, and verify the oracle isn&apos;t lying
          about its input.
        </p>
      </Section>

      <Section id="why-mantle" eyebrow="02" title="Why MNT on Mantle">
        <p>
          Mantle is an EVM L2 with MNT as its native gas token. Settling stakes in
          the same asset that pays for gas keeps the protocol simple and the agent
          economics legible:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card title="No ERC-20 approval dance">
            Stakes use <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">msg.value</code>.
            One signature opens or accepts a claim — no separate{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">approve()</code>{" "}
            tx, no allowance to manage.
          </Card>
          <Card title="One unit of account">
            Agent treasuries, gas, stakes, and payouts are all denominated in MNT.
            P&L is a single subtraction — no FX between gas token and stake asset.
          </Card>
          <Card title="Cheap, deterministic settlement">
            A full claim cycle (create + challenge + resolve) costs a few cents on
            Mantle Sepolia, and pennies on Mantle mainnet. Sub-cent on most cycles.
          </Card>
          <Card title="EVM-native tooling">
            viem, wagmi, MetaMask, Hardhat, Foundry — all work out of the box. No
            custom RPC client, no fork of a tool.
          </Card>
        </div>
      </Section>

      <Section id="architecture" eyebrow="03" title="Architecture">
        <p>
          Three independent tiers, each running where it fits best:
        </p>
        <DiagramFrame caption="Left to right: user wallets → Next.js frontend (Vercel) and worker agents (Railway) → Mantle contract + ancillary services (Neon read-index, LLM provider, ERC-8004 identity registry, Bybit feed).">
          <ArchitectureDiagram />
        </DiagramFrame>
        <ul className="list-disc space-y-2 pl-5 text-pv-text/85">
          <li>
            <strong className="text-pv-text">Frontend (Vercel).</strong> Next.js App
            Router with serverless API routes. Reads come straight from Mantle RPC;
            writes are user-signed via wagmi/viem.
          </li>
          <li>
            <strong className="text-pv-text">Workers (Railway).</strong> The oracle
            and market-creator agents run as long-lived Node processes. Vercel
            functions time out before a polling cycle can finish — Railway is the
            right home. Each agent owns a local EVM private key and signs through
            viem directly; there is no custodial layer.
          </li>
          <li>
            <strong className="text-pv-text">Data (Neon Postgres).</strong> A
            denormalised read-index of on-chain state for the explorer / dashboard
            feeds. Optional — the contract remains source of truth, and pages that
            don&apos;t need feeds work without it.
          </li>
        </ul>
      </Section>

      <Section id="lifecycle" eyebrow="04" title="The claim lifecycle">
        <DiagramFrame caption="Six discrete steps from open to settled. Steps 04–06 are entirely automated by the oracle agent.">
          <LifecycleDiagram />
        </DiagramFrame>
        <p>
          A few details matter for trust:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-pv-text/85">
          <li>
            <strong className="text-pv-text">Evidence hash on chain.</strong>{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">keccak256(raw evidence)</code>{" "}
            lands in contract storage. Anyone can re-fetch the URL, hash it, and
            verify what the oracle actually saw.
          </li>
          <li>
            <strong className="text-pv-text">Confidence is first-class.</strong>{" "}
            The LLM returns a 0–100 number that ships with the verdict. The product
            surfaces it as FIRM (≥80), CONTESTED (60–79), or refund-to-UNRESOLVABLE
            (&lt;60).
          </li>
          <li>
            <strong className="text-pv-text">Refund the ambiguous.</strong>{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">DRAW</code> and{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">UNRESOLVABLE</code>{" "}
            are real verdicts that return stakes. Better inconclusive and refunded
            than wrong and paid out.
          </li>
          <li>
            <strong className="text-pv-text">Oracle-only resolution.</strong>{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">resolveClaim</code>{" "}
            is gated by a single address — the oracle agent&apos;s wallet. No one
            else can re-route payouts.
          </li>
          <li>
            <strong className="text-pv-text">Anti-snipe lock.</strong>{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">challengeClaim</code>{" "}
            rejects any tx that lands within the final 60 seconds before the
            deadline. Stops late-information actors from waiting until the outcome
            is observable and slipping in a zero-risk bet.
          </li>
        </ul>
      </Section>

      <Section id="agents" eyebrow="05" title="The agents">
        <p>
          Two background processes run continuously. Each owns a local EVM private
          key and signs transactions directly through viem — no KMS, no custodial
          dependency.
        </p>
        <DiagramFrame caption="Oracle decision tree. The poll loop reads every claim once a minute; ACTIVE+expired claims go to the settler, OPEN+live claims go to the optional Kelly-sized challenger.">
          <AgentLoopDiagram />
        </DiagramFrame>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Oracle agent">
            Reads expired ACTIVE claims, fetches the evidence URL, asks the LLM for
            a verdict + confidence + one-sentence explanation, and submits{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">resolveClaim</code>{" "}
            on chain. With{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">AUTO_CHALLENGE=1</code>{" "}
            it also stakes the contrarian side on OPEN claims it&apos;s highly
            confident about, sized by the Kelly criterion and capped at 25% of its
            bankroll.
          </Card>
          <Card title="Market-creator agent">
            Polls trusted public sources every six hours — primarily Bybit V5 spot
            tickers for crypto, plus CoinGecko, ESPN, and OpenWeather as secondary
            feeds. It asks the LLM to draft 1&ndash;5 verifiable claim candidates,
            scores each for quality, and creates the highest-scoring ones on chain
            with its own creator-side stake. Opening a claim is an economic
            commitment, not a free tweet.
          </Card>
        </div>
      </Section>

      <Section id="identity" eyebrow="06" title="ERC-8004 agent identity">
        <p>
          Mimir treats AI agents as first-class economic citizens. To make their
          on-chain track record portable and queryable beyond Mimir itself, each
          agent is registered against Mantle&apos;s ERC-8004 IdentityRegistry — an
          NFT-based standard for trustless agents.
        </p>
        <DiagramFrame caption="Two-step registration: mint an identity NFT in the IdentityRegistry, then mirror the resulting tokenId into Mimir.sol so settlement events are attributable.">
          <IdentityDiagram />
        </DiagramFrame>
        <ul className="list-disc space-y-2 pl-5 text-pv-text/85">
          <li>
            <strong className="text-pv-text">Mint an identity.</strong>{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">scripts/register-agents.ts</code>{" "}
            calls <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">IdentityRegistry.register(...)</code>{" "}
            for each agent wallet. The registry returns an{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">agentId</code>{" "}
            ERC-721 token bound to that wallet.
          </li>
          <li>
            <strong className="text-pv-text">Mirror the id.</strong>{" "}
            The same script calls{" "}
            <code className="rounded bg-pv-surface2 px-1.5 py-0.5 text-xs">Mimir.registerAgent(wallet, role, identityId)</code>.
            From that point every settlement event is attributable to a specific
            identity NFT — not just an address.
          </li>
          <li>
            <strong className="text-pv-text">Portable reputation.</strong>{" "}
            Any third party can read the agent&apos;s wins/losses out of Mimir.sol
            and tie them to the same identity NFT that other protocols see. The
            agent&apos;s track record stops being silo&apos;d in one app.
          </li>
        </ul>
      </Section>

      <Section id="contract" eyebrow="07" title="Smart contract terms">
        <p>
          A few terms that show up in the UI and on chain:
        </p>
        <div className="overflow-hidden rounded-2xl border border-pv-border/40">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-pv-surface/60 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-pv-muted">
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">What it means</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pv-border/30">
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">creator</td><td className="px-4 py-3 align-top text-pv-text/85">The address that opened the claim and staked side A.</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">challengerStake</td><td className="px-4 py-3 align-top text-pv-text/85">Sum of all side-B stakes (pool mode) or single counter-stake (1v1).</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">oddsMode</td><td className="px-4 py-3 align-top text-pv-text/85"><code className="rounded bg-pv-surface2 px-1 text-xs">pool</code> = pari-mutuel, <code className="rounded bg-pv-surface2 px-1 text-xs">fixed</code> = creator-backed multipliers.</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">deadline</td><td className="px-4 py-3 align-top text-pv-text/85">UTC unix timestamp. After this the oracle can settle.</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">winnerSide</td><td className="px-4 py-3 align-top text-pv-text/85"><code className="rounded bg-pv-surface2 px-1 text-xs">CREATOR</code>, <code className="rounded bg-pv-surface2 px-1 text-xs">CHALLENGERS</code>, <code className="rounded bg-pv-surface2 px-1 text-xs">DRAW</code> (refund), or <code className="rounded bg-pv-surface2 px-1 text-xs">UNRESOLVABLE</code> (refund).</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">evidenceHash</td><td className="px-4 py-3 align-top text-pv-text/85"><code className="rounded bg-pv-surface2 px-1 text-xs">keccak256</code> of the raw bytes the oracle fetched from the resolution URL.</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">confidence</td><td className="px-4 py-3 align-top text-pv-text/85">0–100. The LLM&apos;s self-assessed certainty for that verdict.</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">agentRole</td><td className="px-4 py-3 align-top text-pv-text/85">Free-form tag (&ldquo;oracle&rdquo;, &ldquo;market-creator&rdquo;) attached to registered agent wallets.</td></tr>
              <tr><td className="px-4 py-3 align-top font-mono text-xs text-pv-emerald">agentIdentityId</td><td className="px-4 py-3 align-top text-pv-text/85">The agent&apos;s ERC-8004 IdentityRegistry tokenId, mirrored on chain for attribution.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="play" eyebrow="08" title="How to play">
        <ol className="list-decimal space-y-3 pl-5 text-pv-text/85">
          <li>
            <strong className="text-pv-text">Get testnet MNT.</strong>{" "}
            <a className="text-pv-emerald underline" href="https://faucet.sepolia.mantle.xyz" target="_blank" rel="noreferrer">faucet.sepolia.mantle.xyz</a>{" "}
            (Mantle Sepolia, chain 5003). All stakes settle in native MNT — no
            bridges, no approvals.
          </li>
          <li>
            <strong className="text-pv-text">Connect your wallet.</strong>{" "}
            The site auto-switches you to Mantle Sepolia on connect and adds the
            chain if your wallet doesn&apos;t know it yet.
          </li>
          <li>
            <strong className="text-pv-text">Either create a claim or challenge one.</strong>{" "}
            Browse the <Link href="/explorer" className="text-pv-emerald underline">explorer</Link>{" "}
            for open markets, or open your own with{" "}
            <Link href="/vs/create" className="text-pv-emerald underline">/vs/create</Link>.
            Stake at least 2 MNT.
          </li>
          <li>
            <strong className="text-pv-text">Wait.</strong>{" "}
            At the deadline the oracle does its thing. You don&apos;t need to
            click anything — the contract pays out automatically.
          </li>
          <li>
            <strong className="text-pv-text">Check the receipt.</strong>{" "}
            The settlement card shows the verdict, the explanation, the evidence
            hash, and the on-chain tx.
          </li>
        </ol>
      </Section>

      <Section id="faq" eyebrow="09" title="FAQ">
        <div className="space-y-5">
          <Card title="Do I need MetaMask?">
            Any injected EVM wallet works (MetaMask, Coinbase Wallet, Rabby,
            Phantom EVM, etc.). The frontend uses wagmi v3 with the Mantle chain
            pre-registered.
          </Card>
          <Card title="What if the LLM is wrong?">
            The verdict ships with a confidence number, the evidence URL, and a{" "}
            <code className="rounded bg-pv-surface2 px-1 text-xs">keccak256</code>{" "}
            hash of the raw page bytes. Anyone can verify the oracle wasn&apos;t
            hallucinating. Truly ambiguous claims resolve as{" "}
            <code className="rounded bg-pv-surface2 px-1 text-xs">UNRESOLVABLE</code>{" "}
            and refund — the protocol prefers refunding ambiguity to fabricating
            certainty.
          </Card>
          <Card title="Can the oracle be replaced?">
            The contract&apos;s <code className="rounded bg-pv-surface2 px-1 text-xs">oracle</code> address
            is set at deploy and changeable only by the owner. The deploy script
            transfers ownership to the market-creator address immediately after
            deploy, so a single agent key isn&apos;t both signer and admin.
          </Card>
          <Card title="Is the agent betting against me?">
            Only with <code className="rounded bg-pv-surface2 px-1 text-xs">AUTO_CHALLENGE=1</code>{" "}
            enabled, and only when its own confidence on the contrarian side is
            ≥ 80%. Stake size is Kelly-bounded at 25% of bankroll, with an
            additional 10% hard cap. The contract blocks a wallet from being
            both creator and challenger of the same claim.
          </Card>
          <Card title="Why ERC-8004?">
            It&apos;s the emerging NFT-based standard for autonomous agent identity.
            Registering Mimir agents against Mantle&apos;s IdentityRegistry means
            their wins, losses, and accuracy are queryable from any other protocol
            that reads the same registry — the agent&apos;s reputation isn&apos;t
            trapped inside Mimir.
          </Card>
          <Card title="Mainnet?">
            The codebase is chain-config driven (see{" "}
            <code className="rounded bg-pv-surface2 px-1 text-xs">lib/mantle.ts</code>) —
            set <code className="rounded bg-pv-surface2 px-1 text-xs">NEXT_PUBLIC_MANTLE_MAINNET=1</code>{" "}
            to target Mantle mainnet (chain 5000) instead of Sepolia.
          </Card>
        </div>
      </Section>

      <footer className="border-t border-pv-border/30 pt-8 text-sm text-pv-muted">
        Got a question that isn&apos;t answered here?{" "}
        <a className="text-pv-emerald underline" href="https://github.com/enliven17/mimir" target="_blank" rel="noreferrer">
          Open an issue on GitHub
        </a>
        .
      </footer>
    </article>
  );
}
