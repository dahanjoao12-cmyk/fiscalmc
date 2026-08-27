export type ReadinessItemKey = "registration" | "fiscal" | "services" | "certificate" | "clientAccess";
export type ReadinessItem = { key: ReadinessItemKey; ready: boolean; message: string; warning?: string };

export function getOrganizationReadiness(input: {
  registration: { municipalRegistration?: string | null; street?: string | null; addressNumber?: string | null; neighborhood?: string | null; state?: string | null };
  fiscal: { ready: boolean; message: string };
  services: { ready: boolean; message: string };
  certificate: { ready: boolean; message: string; warning?: string };
  clientAccess: { ready: boolean; message: string };
}) {
  const registrationReady = Boolean(input.registration.municipalRegistration?.trim() && input.registration.street?.trim() && input.registration.addressNumber?.trim() && input.registration.neighborhood?.trim() && input.registration.state?.trim());
  const items: ReadinessItem[] = [
    { key: "registration", ready: registrationReady, message: registrationReady ? "Dados cadastrais completos." : "Dados cadastrais requerem atenção." },
    { key: "fiscal", ...input.fiscal },
    { key: "services", ...input.services },
    { key: "certificate", ...input.certificate },
    { key: "clientAccess", ...input.clientAccess },
  ];
  return { items, overallReady: items.every((item) => item.ready) };
}
