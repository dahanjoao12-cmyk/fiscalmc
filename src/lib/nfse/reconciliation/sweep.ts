import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileUnknownInvoice } from "./service";
import { logEvent } from "@/lib/observability/logger";

export const DEFAULT_SWEEP_LIMIT = 50;

/**
 * Constant-time comparison so a mismatched secret can't be brute-forced by
 * timing the response. Any length mismatch (including a missing/empty
 * expected or provided value) is treated as unauthorized without comparing.
 */
export function isAuthorizedInternalRequest(providedSecret: string | null, expectedSecret: string | undefined): boolean {
  if (!expectedSecret || !providedSecret) return false;
  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export type SweepResult = { checked: number; resolved: number; stillUnknown: number; failed: number };

/**
 * Sweeps every invoice still UNKNOWN and asks SEFIN once per invoice via the
 * same reconcileUnknownInvoice used by the manual "verify now" buttons — it
 * never retransmits and no-ops on anything not still UNKNOWN. One invoice
 * failing (expired certificate, SEFIN unavailable, etc.) never stops the rest
 * of the batch.
 */
export async function sweepUnknownInvoices(input: { db: SupabaseClient; limit?: number; reconcile?: typeof reconcileUnknownInvoice }): Promise<SweepResult> {
  const limit = input.limit ?? DEFAULT_SWEEP_LIMIT;
  const reconcile = input.reconcile ?? reconcileUnknownInvoice;
  const { data: pending, error } = await input.db.from("invoices").select("id,organization_id").eq("status", "UNKNOWN").order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error("PENDING_INVOICES_LOOKUP_FAILED");

  const results: SweepResult = { checked: 0, resolved: 0, stillUnknown: 0, failed: 0 };
  for (const invoice of pending ?? []) {
    results.checked += 1;
    try {
      const outcome = await reconcile({ invoiceId: invoice.id, organizationId: invoice.organization_id });
      if (outcome.status === "UNKNOWN") results.stillUnknown += 1;
      else results.resolved += 1;
    } catch (cause) {
      results.failed += 1;
      logEvent("warn", "RECONCILE_PENDING_ITEM_FAILED", { invoiceId: invoice.id, error: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause) });
    }
  }
  return results;
}
