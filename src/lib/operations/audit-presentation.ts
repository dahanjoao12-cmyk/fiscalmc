export function presentAuditEvent(action: string) {
  const labels: Record<string, { label: string; area: string }> = {
    invoice_requested: { label: "Emissão solicitada", area: "Emissões" },
    nfse_artifacts_recovered: { label: "Documentos da NFS-e recuperados", area: "Documentos" },
    artifact_downloaded: { label: "Documento baixado", area: "Documentos" },
    service_municipal_lookup_operationally_verified: { label: "Configuração do serviço verificada", area: "Serviços" },
    organization_restricted_emission_enabled: { label: "Emissão em homologação habilitada", area: "Emissões" },
    client_catalog_service_auto_ready: { label: "Serviço configurado automaticamente", area: "Serviços" },
    client_catalog_service_needs_review: { label: "Serviço enviado para revisão", area: "Serviços" },
  };
  return labels[action] ?? { label: "Atualização operacional registrada", area: "Operação" };
}

export function presentAuditActor(actor: string | null) {
  return actor === "CLIENT" ? "Cliente" : actor === "OFFICE" ? "Escritório" : actor === "SYSTEM" ? "Sistema" : "Não informado";
}
