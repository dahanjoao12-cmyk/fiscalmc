import { describe, expect, it } from "vitest";
import { canRequestCancellation, cancellationReplayDecision, assertCancellationTransmissionBlocked } from "@/lib/nfse/cancellation/state-machine";
import { getCertificateOperationalState, getOperationalPriority, getCancellationStatusPresentation } from "@/lib/operations/queue";
import { artifactDownloadName, hasDanfseArtifact, hasOfficialNfseArtifact } from "@/lib/nfse/artifacts/model";

describe("fila operacional", () => {
  it("classifica prioridades de forma determinística", () => {
    expect(getOperationalPriority("CERTIFICATE_EXPIRED")).toBe("CRITICAL");
    expect(getOperationalPriority("INVOICE_UNKNOWN", { ageHours: 2 })).toBe("HIGH");
    expect(getOperationalPriority("SERVICE_PENDING_REVIEW")).toBe("NORMAL");
  });
  it("reutiliza a regra central para certificados vencendo", () => {
    expect(getCertificateOperationalState({ status: "VALID", validUntil: "2020-01-01T00:00:00.000Z" })?.type).toBe("CERTIFICATE_EXPIRED");
  });
  it("mantém uma apresentação humana para cancelamento", () => {
    expect(getCancellationStatusPresentation("REQUESTED").label).toBe("Solicitado");
  });
});

describe("segurança do cancelamento", () => {
  it("só permite solicitar cancelamento para nota emitida", () => {
    expect(canRequestCancellation("ISSUED")).toBe(true);
    expect(canRequestCancellation("UNKNOWN")).toBe(false);
  });
  it("não permite retransmitir cegamente um cancelamento UNKNOWN", () => {
    expect(cancellationReplayDecision("UNKNOWN")).toBe("RECONCILE_ONLY");
  });
  it("mantém o transporte oficial explicitamente bloqueado", () => {
    expect(assertCancellationTransmissionBlocked).toThrow("CANCELLATION_TRANSMISSION_BLOCKED");
  });
});

describe("artefatos fiscais privados", () => {
  it("diferencia a DPS do XML oficial da NFS-e", () => {
    expect(hasOfficialNfseArtifact([{ artifact_type: "DPS_XML" }])).toBe(false);
    expect(hasOfficialNfseArtifact([{ artifact_type: "NFSE_XML" }])).toBe(true);
    expect(hasDanfseArtifact([{ artifact_type: "DANFSE_PDF" }])).toBe(true);
  });

  it("gera nomes de download seguros sem usar paths de storage", () => {
    expect(artifactDownloadName({ artifact_type: "NFSE_XML", invoiceId: "invoice-1", nfseNumber: "12/../34" })).toBe("nfse-1234.xml");
    expect(artifactDownloadName({ artifact_type: "DANFSE_PDF", invoiceId: "invoice-1" })).toBe("danfse-invoice-1.pdf");
  });
});
