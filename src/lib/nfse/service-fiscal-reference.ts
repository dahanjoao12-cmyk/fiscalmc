import { z } from "zod";

/**
 * A document accepted in production is evidence for a reviewed service, not
 * an immutable municipal catalog rule.
 */
export const acceptedProductionDpsReferenceSchema = z.object({
  source: z.literal("ACCEPTED_PRODUCTION_DPS"),
  referenceNFse: z.string().trim().min(1).max(40),
  referenceDps: z.string().trim().min(1).max(40),
  referenceCompetence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cTribNac: z.string().regex(/^\d{6}$/),
  cTribMun: z.string().regex(/^\d{3}$/),
  cNbs: z.string().regex(/^\d{9}$/),
  issTaxation: z.enum(["1", "2", "3", "4"]),
  issWithholding: z.enum(["1", "2", "3"]),
}).strict();

export type AcceptedProductionDpsReference = z.infer<typeof acceptedProductionDpsReferenceSchema>;
export const issRateSources = ["PARAMETRIZED_BY_NATIONAL", "EMITTER_PROVIDED"] as const;
export type IssRateSource = (typeof issRateSources)[number];
export const issRateSourceSchema = z.enum(issRateSources);

export function readAcceptedProductionDpsReference(value: unknown) {
  const parsed = acceptedProductionDpsReferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function matchesAcceptedProductionDpsReference(
  value: unknown,
  input: { nationalTaxCode: string; municipalTaxCode: string; nbsCode?: string | null },
) {
  const reference = readAcceptedProductionDpsReference(value);
  if (!reference) return false;
  return reference.cTribNac === input.nationalTaxCode
    && reference.cTribMun === input.municipalTaxCode
    && (!input.nbsCode || reference.cNbs === input.nbsCode);
}
