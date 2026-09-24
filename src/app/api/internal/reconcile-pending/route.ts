import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedInternalRequest, sweepUnknownInvoices } from "@/lib/nfse/reconciliation/sweep";
import { logEvent } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-to-server only: called on a timer (systemd, cron, etc.), never by a
 * logged-in user — authenticated by a shared secret, not a Supabase session.
 * Nothing about UNKNOWN invoices was ever checked on its own before this; the
 * client/office "verify now" buttons were the only trigger.
 */
export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request.headers.get("x-internal-secret"), process.env.INTERNAL_RECONCILE_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await sweepUnknownInvoices({ db: createAdminClient() });
    logEvent("info", "RECONCILE_PENDING_SWEEP", results);
    return NextResponse.json(results);
  } catch (error) {
    logEvent("error", "RECONCILE_PENDING_SWEEP_FAILED", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Não foi possível varrer as notas pendentes." }, { status: 500 });
  }
}
