import { describe, expect, it, vi } from "vitest";
import { ClientAccessError, ClientAccessService, type ClientAccessGateway } from "@/lib/auth/client-access-service";
import { buildTechnicalClientEmail, getClientAccessReadiness, normalizeClientCnpj } from "@/lib/auth/client-access-model";
import { signInClientWithCnpj } from "@/lib/auth/client-login";
import { can } from "@/lib/security/authorization";
import { getOrganizationReadiness } from "@/lib/organizations/readiness";

const organization = { id: "00000000-0000-4000-8000-000000000001", legalName: "Empresa de Teste", taxId: "40241895000170" };

function gateway(overrides: Partial<ClientAccessGateway> = {}): ClientAccessGateway {
  return {
    getOrganization: vi.fn(async (id) => id === organization.id ? organization : null),
    getAccess: vi.fn(async () => null),
    createAuthUser: vi.fn(async () => "10000000-0000-4000-8000-000000000001"),
    registerAccess: vi.fn(async () => undefined),
    cleanupFailedRegistration: vi.fn(async () => undefined),
    updateAuthUser: vi.fn(async () => undefined),
    setAccessState: vi.fn(async () => undefined),
    recordPasswordReset: vi.fn(async () => undefined),
    ...overrides,
  };
}

const activeAccess = {
  organizationId: organization.id,
  userId: "10000000-0000-4000-8000-000000000001",
  technicalEmail: "hidden@auth.fiscalmc.internal",
  enabled: true,
  createdAt: "2026-08-27T12:00:00.000Z",
  blockedAt: null,
  membership: { active: true, role: "CLIENT_USER" },
  authUserActive: true,
};

describe("client access identity", () => {
  it("normaliza CNPJ com ou sem máscara", () => {
    expect(normalizeClientCnpj("40.241.895/0001-70")).toBe("40241895000170");
    expect(normalizeClientCnpj("40241895000170")).toBe("40241895000170");
    expect(normalizeClientCnpj("00.000.000/0000-00")).toBeNull();
  });

  it("gera identidade técnica determinística e separada por ambiente", () => {
    const production = buildTechnicalClientEmail(organization.taxId, "project-production");
    expect(production).toBe(buildTechnicalClientEmail(organization.taxId, "project-production"));
    expect(production).not.toBe(buildTechnicalClientEmail(organization.taxId, "project-staging"));
    expect(production).not.toContain("Empresa de Teste");
  });
});

describe("client access lifecycle", () => {
  it("cria Auth user e vínculos sem persistir senha nos registros relacionais", async () => {
    const fake = gateway();
    const service = new ClientAccessService(fake);
    vi.mocked(fake.getAccess).mockResolvedValueOnce(null).mockResolvedValueOnce(activeAccess);
    const result = await service.create({ organizationId: organization.id, password: "senha-segura", actorUserId: "actor" });
    expect(fake.createAuthUser).toHaveBeenCalledWith(expect.objectContaining({ password: "senha-segura", organizationId: organization.id }));
    expect(fake.registerAccess).toHaveBeenCalledWith(expect.not.objectContaining({ password: expect.anything() }));
    expect(result.readiness.ready).toBe(true);
  });

  it("impede segundo acesso principal", async () => {
    const service = new ClientAccessService(gateway({ getAccess: vi.fn(async () => activeAccess) }));
    await expect(service.create({ organizationId: organization.id, password: "senha-segura", actorUserId: "actor" })).rejects.toMatchObject({ code: "CLIENT_ACCESS_ALREADY_EXISTS" });
  });

  it("remove usuário Auth quando o vínculo relacional falha", async () => {
    const fake = gateway({ registerAccess: vi.fn(async () => { throw new Error("database"); }) });
    const service = new ClientAccessService(fake);
    await expect(service.create({ organizationId: organization.id, password: "senha-segura", actorUserId: "actor" })).rejects.toBeInstanceOf(ClientAccessError);
    expect(fake.cleanupFailedRegistration).toHaveBeenCalledWith(organization.id, activeAccess.userId);
  });

  it("bloqueia no Auth e na membership", async () => {
    const fake = gateway({ getAccess: vi.fn(async () => activeAccess) });
    await new ClientAccessService(fake).block({ organizationId: organization.id, actorUserId: "actor" });
    expect(fake.updateAuthUser).toHaveBeenCalledWith(activeAccess.userId, { ban_duration: "876000h" });
    expect(fake.setAccessState).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, organizationId: organization.id }));
  });

  it("reativa e redefine senha sem recuperar a anterior", async () => {
    const fake = gateway({ getAccess: vi.fn(async () => ({ ...activeAccess, enabled: false, membership: { active: false, role: "CLIENT_USER" } })) });
    const service = new ClientAccessService(fake);
    await service.reactivate({ organizationId: organization.id, actorUserId: "actor" });
    expect(fake.updateAuthUser).toHaveBeenCalledWith(activeAccess.userId, { ban_duration: "none" });
    await service.resetPassword({ organizationId: organization.id, actorUserId: "actor", password: "outra-senha" });
    expect(fake.updateAuthUser).toHaveBeenLastCalledWith(activeAccess.userId, { password: "outra-senha" });
    expect(fake.recordPasswordReset).toHaveBeenCalled();
  });
});

describe("client login", () => {
  const resolved = async () => ({ technicalEmail: activeAccess.technicalEmail, userId: activeAccess.userId });

  it("autentica senha correta pela identidade técnica", async () => {
    const signIn = vi.fn(async () => true);
    await expect(signInClientWithCnpj(organization.taxId, "senha-segura", signIn, resolved)).resolves.toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledWith(activeAccess.technicalEmail, "senha-segura");
  });

  it.each([
    ["senha errada", async () => false, resolved],
    ["CNPJ desconhecido", async () => true, async () => null],
    ["membership bloqueada", async () => true, async () => null],
  ])("retorna erro genérico para %s", async (_, signIn, resolve) => {
    const result = await signInClientWithCnpj(organization.taxId, "senha", signIn, resolve);
    expect(result).toEqual({ ok: false, message: "CNPJ ou senha inválidos." });
  });
});

describe("client access readiness and authorization", () => {
  it("exige acesso, membership CLIENT_USER e Auth ativos", () => {
    expect(getClientAccessReadiness({ access: { enabled: true }, membership: { active: true, role: "CLIENT_USER" }, authUserActive: true }).ready).toBe(true);
    expect(getClientAccessReadiness({ access: { enabled: false }, membership: { active: false, role: "CLIENT_USER" }, authUserActive: false }).ready).toBe(false);
    expect(getClientAccessReadiness({ access: { enabled: true }, membership: { active: true, role: "SUPER_ADMIN" }, authUserActive: true }).ready).toBe(false);
  });

  it("não libera emissão nem readiness geral apenas pelo acesso", () => {
    const readiness = getOrganizationReadiness({ registration: {}, fiscal: { ready: false, message: "Fiscal pendente" }, services: { ready: false, message: "Serviço pendente" }, certificate: { ready: false, message: "Certificado pendente" }, clientAccess: { ready: true, message: "Ativo" } });
    expect(readiness.overallReady).toBe(false);
    expect(readiness.items.find((item) => item.key === "clientAccess")?.ready).toBe(true);
  });

  it("CLIENT_USER não possui permissões administrativas", () => {
    expect(can("CLIENT_USER", "client-access:read")).toBe(false);
    expect(can("CLIENT_USER", "client-access:write")).toBe(false);
    expect(can("CLIENT_USER", "company:write")).toBe(false);
  });
});
