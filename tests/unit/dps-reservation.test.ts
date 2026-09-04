import { describe, expect, it, vi } from "vitest";
import { reserveDpsNumber } from "@/lib/nfse/issuance/dps-reservation";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("reserva de DPS autenticada", () => {
  it("envia somente organização, ambiente e série à RPC ligada à sessão", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 17, error: null });
    await expect(reserveDpsNumber({ rpc }, { organizationId, series: "00001" })).resolves.toBe(17);
    expect(rpc).toHaveBeenCalledWith("reserve_dps_number", {
      target_org: organizationId,
      target_env: "PRODUCTION_RESTRICTED",
      target_series: "00001",
    });
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("actor_user_id");
  });

  it("falha de forma segura quando a RPC não confirma uma reserva", async () => {
    await expect(reserveDpsNumber(
      { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } }) },
      { organizationId, series: "00001" },
    )).rejects.toMatchObject({ code: "DPS_RESERVATION_FAILED" });
  });

  it("preserva a separação de sequência ao solicitar Produção", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    await reserveDpsNumber({ rpc }, { organizationId, series: "00001", environment: "PRODUCTION" });
    expect(rpc).toHaveBeenCalledWith("reserve_dps_number", expect.objectContaining({ target_env: "PRODUCTION" }));
  });

  it("preserva números distintos sob chamadas concorrentes confirmadas pela RPC", async () => {
    let next = 1;
    const rpc = vi.fn().mockImplementation(async () => ({ data: next++, error: null }));
    const values = await Promise.all([
      reserveDpsNumber({ rpc }, { organizationId, series: "00001" }),
      reserveDpsNumber({ rpc }, { organizationId, series: "00001" }),
    ]);
    expect(values).toEqual([1, 2]);
  });
});
