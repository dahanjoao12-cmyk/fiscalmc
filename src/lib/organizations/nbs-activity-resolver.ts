import "server-only";
import correlations from "./activity-nbs-correlations.json";

type Correlation = { lc116Item: string; lc116Subitem: string; lc116Description: string; nbsCode: string; nbsDisplayCode: string; nbsDescription: string };

export type NbsCandidate = { nbsCode: string; nbsDisplayCode: string; nbsDescription: string };

const allNbs: NbsCandidate[] = (() => {
  const byCode = new Map<string, NbsCandidate>();
  for (const row of correlations as Correlation[]) {
    if (!byCode.has(row.nbsCode)) byCode.set(row.nbsCode, { nbsCode: row.nbsCode, nbsDisplayCode: row.nbsDisplayCode, nbsDescription: row.nbsDescription });
  }
  return [...byCode.values()].sort((a, b) => a.nbsDisplayCode.localeCompare(b.nbsDisplayCode));
})();

/**
 * Free-text search across every NBS code in the official Anexo VIII table,
 * independent of whichever LC116 national code was selected — the same
 * service can be classified under different LC116 items depending on how
 * the office frames it, so the NBS choice must not be constrained to only
 * the codes correlated to one specific activity. Never picks one on its
 * own — a human always makes the final call.
 */
export function searchNbsCatalog(query: string, limit = 60): NbsCandidate[] {
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const pool = q ? allNbs.filter((item) => item.nbsDisplayCode.toLowerCase().includes(q) || item.nbsDescription.toLocaleLowerCase("pt-BR").includes(q)) : allNbs;
  return pool.slice(0, limit);
}
