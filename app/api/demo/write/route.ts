import { NextResponse } from "next/server";

import { createApiError } from "@/lib/server/api-validation";
import { executeDemoWrite } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_ACTIONS = new Set([
  "create_claim",
  "challenge_claim",
  "resolve_claim",
  "cancel_claim",
  "create_rematch",
]);

/**
 * Demo relay — server-side signer for the no-MetaMask flow.
 *
 * Only active when NEXT_PUBLIC_DEMO_MODE=1 and a DEMO_*_PRIVATE_KEY is set.
 * The browser client (lib/contract.ts → sendDemoTx) posts {action, params}
 * here; the matching demo key signs the Mantle transaction. Never enabled in
 * a normal user-signed deployment.
 */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "1") {
    return NextResponse.json(
      createApiError("feature_disabled", "Demo mode is not enabled"),
      { status: 404 }
    );
  }

  let body: { action?: unknown; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      createApiError("invalid_body", "Request body must be valid JSON"),
      { status: 400 }
    );
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      createApiError("invalid_parameter", `Unknown demo action: ${action || "(missing)"}`),
      { status: 400 }
    );
  }

  const params =
    body.params && typeof body.params === "object"
      ? (body.params as Record<string, unknown>)
      : {};

  try {
    const result = await executeDemoWrite(action, params);
    return NextResponse.json(
      {
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        claimId: result.claimId,
        pending: result.pending ?? false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Demo relay failed";
    return NextResponse.json(
      createApiError("internal_error", message),
      { status: /no demo key configured/i.test(message) ? 503 : 500 }
    );
  }
}
