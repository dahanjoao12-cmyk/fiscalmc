import "server-only";
import correlations from "./activity-nbs-correlations.json";

type Correlation = { lc116Item: string; lc116Subitem: string; lc116Description: string; nbsCode: string; nbsDisplayCode: string; nbsDescription: string };

const byActivity = new Map<string, Correlation[]>();
for (const row of correlations as Correlation[]) {
  const key = `${row.lc116Item}.${row.lc116Subitem}`;
  const list = byActivity.get(key) ?? [];
  list.push(row);
  byActivity.set(key, list);
}

export type NbsCandidate = { nbsCode: string; nbsDisplayCode: string; nbsDescription: string };

/**
 * Resolves the NBS candidates correlated to a national LC116 item/subitem, per
 * the official Anexo VIII correlation. One activity may correlate to several
 * NBS codes depending on the service actually rendered — callers must let a
 * human pick, never auto-select.
 */
export function getNbsCandidatesForActivity(item: string, subitem: string | null): NbsCandidate[] {
  if (!subitem) return [];
  const rows = byActivity.get(`${item}.${subitem}`) ?? [];
  return rows.map((row) => ({ nbsCode: row.nbsCode, nbsDisplayCode: row.nbsDisplayCode, nbsDescription: row.nbsDescription }));
}
