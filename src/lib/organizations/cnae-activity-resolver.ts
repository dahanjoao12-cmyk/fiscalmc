import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import correlations from "./cnae-lc116-correlations.json";

type Correlation = { cnae: string; cnaeDescription: string; lc116Item: string; lc116Subitem: string; lc116Description: string };

const byCnae = new Map<string, Correlation[]>();
for (const row of correlations as Correlation[]) {
  const list = byCnae.get(row.cnae) ?? [];
  list.push(row);
  byCnae.set(row.cnae, list);
}

export type ResolvedActivityCandidate = {
  nationalServiceCodeId: string;
  code: string;
  displayCode: string;
  description: string;
};

export type CnaeActivityResolution = {
  cnae: string;
  /** Number of distinct LC116 items correlated to this CNAE (per Anexo VIII). */
  lc116ItemCount: number;
  /** Resolved national_service_codes candidates. Exactly one means an unambiguous match. */
  candidates: ResolvedActivityCandidate[];
};

/**
 * Resolves a CNAE code (from the company's own CNPJ card) to national service
 * code candidates, via the official CNAE x Item-LC116 correlation. Never picks
 * a candidate on its own — callers decide what to do when candidates.length !== 1.
 */
export async function resolveCnaeActivity(db: SupabaseClient, cnae: string): Promise<CnaeActivityResolution> {
  const normalized = cnae.replace(/\D/g, "").padStart(7, "0").slice(0, 7);
  const matches = byCnae.get(normalized) ?? [];
  if (!matches.length) return { cnae: normalized, lc116ItemCount: 0, candidates: [] };

  const uniquePairs = [...new Map(matches.map((row) => [`${row.lc116Item}.${row.lc116Subitem}`, row])).values()];
  const candidates: ResolvedActivityCandidate[] = [];
  for (const pair of uniquePairs) {
    const { data } = await db.from("national_service_codes").select("id,code,display_code,description").eq("item", pair.lc116Item).eq("subitem", pair.lc116Subitem).eq("active", true);
    for (const row of data ?? []) candidates.push({ nationalServiceCodeId: row.id, code: row.code, displayCode: row.display_code, description: row.description });
  }
  return { cnae: normalized, lc116ItemCount: uniquePairs.length, candidates };
}
