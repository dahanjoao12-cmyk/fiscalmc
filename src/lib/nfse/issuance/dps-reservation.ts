import { z } from "zod";
import { SafeFiscalError } from "../errors";

type AuthenticatedReservationClient = {
  rpc: (functionName: "reserve_dps_number", args: {
    target_org: string;
    target_env: "PRODUCTION_RESTRICTED";
    target_series: string;
  }) => PromiseLike<{ data: unknown; error: unknown }>;
};

const dpsNumberSchema = z.number().int().positive();

/**
 * Reserves a sequence through the caller's Supabase session. The database
 * function derives the actor from auth.uid(); no actor id crosses this API.
 */
export async function reserveDpsNumber(
  client: AuthenticatedReservationClient,
  input: { organizationId: string; series: string },
) {
  const reservation = await client.rpc("reserve_dps_number", {
    target_org: input.organizationId,
    target_env: "PRODUCTION_RESTRICTED",
    target_series: input.series,
  });
  const number = dpsNumberSchema.safeParse(reservation.data);
  if (reservation.error || !number.success) {
    throw new SafeFiscalError(
      "DPS_RESERVATION_FAILED",
      "Não foi possível reservar a sequência da DPS para esta empresa.",
    );
  }
  return number.data;
}
