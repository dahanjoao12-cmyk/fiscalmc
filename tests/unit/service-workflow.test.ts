import { describe, expect, it } from "vitest";
import {
  buildClientServiceCreate,
  buildClientServiceSubmission,
  buildClientServiceUpdate,
  buildOfficeServiceApproval,
  buildServiceInformationRequest,
  clientServiceMutationSchema,
  type ClientServiceRecord,
} from "@/lib/services/workflow";

const record: ClientServiceRecord = {
  name: "Consultoria contábil",
  default_description: "Assessoria mensal.",
  client_service_location: null,
  client_note: null,
  workflow_status: "DRAFT",
  active: false,
  reviewed_at: null,
  reviewed_by: null,
  submitted_at: null,
};

const fields = {
  name: "Consultoria contábil",
  defaultDescription: "Assessoria mensal.",
  serviceLocationMode: "ORGANIZATION" as const,
  serviceLocation: null,
  clientNote: null,
};

describe("client service workflow", () => {
  it("cria um rascunho comercial sem inventar classificação fiscal", () => {
    const created = buildClientServiceCreate(fields, "user-id");
    expect(created).toMatchObject({ workflow_status: "DRAFT", created_via: "CLIENT", active: false, reviewed_at: null });
    expect(created).not.toHaveProperty("national_tax_code");
    expect(created).not.toHaveProperty("municipal_service_code");
  });

  it("bloqueia campos fiscais enviados pelo cliente", () => {
    const result = clientServiceMutationSchema.safeParse({ action: "update", id: "d9428888-122b-11e1-b85c-61cd3cbb3210", ...fields, nationalTaxCode: "17.19.01" });
    expect(result.success).toBe(false);
    expect(clientServiceMutationSchema.safeParse({ action: "update", id: "d9428888-122b-11e1-b85c-61cd3cbb3210", ...fields, organizationId: "organization-b" }).success).toBe(false);
    expect(clientServiceMutationSchema.safeParse({ action: "update", id: "d9428888-122b-11e1-b85c-61cd3cbb3210", ...fields, serviceLocationMunicipalityCode: "3304557" }).success).toBe(false);
  });

  it("envia DRAFT para PENDING_REVIEW", () => {
    expect(buildClientServiceSubmission(record, "2026-08-28T12:00:00.000Z")).toMatchObject({ workflow_status: "PENDING_REVIEW", active: false, submitted_at: "2026-08-28T12:00:00.000Z" });
  });

  it("mantém uma alteração de serviço enviado em PENDING_REVIEW", () => {
    const pending = { ...record, workflow_status: "PENDING_REVIEW" as const, submitted_at: "2026-08-27T12:00:00.000Z" };
    const update = buildClientServiceUpdate(pending, { ...fields, defaultDescription: "Descrição comercial atualizada." }, "2026-08-28T12:00:00.000Z");
    expect(update.values).toMatchObject({ workflow_status: "PENDING_REVIEW", submitted_at: "2026-08-28T12:00:00.000Z" });
  });

  it("permite corrigir NEEDS_INFO e reenviar", () => {
    const needsInfo = { ...record, workflow_status: "NEEDS_INFO" as const, submitted_at: "2026-08-27T12:00:00.000Z" };
    const changed = buildClientServiceUpdate(needsInfo, { ...fields, serviceLocationMode: "OTHER", serviceLocation: "Rio de Janeiro/RJ", clientNote: "Prestado no município do Rio." }, "2026-08-28T12:00:00.000Z");
    expect(changed.values).not.toHaveProperty("workflow_status");
    expect(buildClientServiceSubmission(needsInfo, "2026-08-28T12:01:00.000Z").workflow_status).toBe("PENDING_REVIEW");
  });

  it("remove a revisão após alteração material do cliente", () => {
    const reviewed: ClientServiceRecord = { ...record, workflow_status: "REVIEWED", active: true, reviewed_at: "2026-08-27T12:00:00.000Z", reviewed_by: "office-user" };
    const update = buildClientServiceUpdate(reviewed, { ...fields, defaultDescription: "Assessoria mensal e suporte contábil." }, "2026-08-28T12:00:00.000Z");
    expect(update.reviewReset).toBe(true);
    expect(update.values).toMatchObject({ workflow_status: "PENDING_REVIEW", active: false, reviewed_at: null, reviewed_by: null });
  });

  it("não permite reenviar serviço inativo ou já revisado", () => {
    expect(() => buildClientServiceSubmission({ workflow_status: "INACTIVE" }, "now")).toThrow("SERVICE_INACTIVE");
    expect(() => buildClientServiceSubmission({ workflow_status: "REVIEWED" }, "now")).toThrow("SERVICE_ALREADY_REVIEWED");
  });

  it("escritório solicita informação somente de serviço pendente", () => {
    expect(buildServiceInformationRequest("PENDING_REVIEW", "Confirme o local da prestação.", null, "2026-08-28T12:00:00.000Z")).toMatchObject({ workflow_status: "NEEDS_INFO", active: false });
    expect(() => buildServiceInformationRequest("DRAFT", "Confirme o local da prestação.", null, "now")).toThrow("SERVICE_NOT_PENDING_REVIEW");
  });

  it("aprova serviço do cliente somente após envio e permite draft criado pelo escritório", () => {
    expect(buildOfficeServiceApproval("PENDING_REVIEW", "CLIENT", "now", "reviewer")).toMatchObject({ workflow_status: "REVIEWED", active: true, reviewed_by: "reviewer" });
    expect(buildOfficeServiceApproval("DRAFT", "OFFICE", "now", "reviewer").workflow_status).toBe("REVIEWED");
    expect(() => buildOfficeServiceApproval("DRAFT", "CLIENT", "now", "reviewer")).toThrow("SERVICE_WORKFLOW_NOT_APPROVABLE");
  });
});
