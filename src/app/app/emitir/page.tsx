import { IssueForm, type IssueCustomer, type IssueService } from "@/components/issue-form";
import { MockBanner } from "@/components/mock-banner";
import { PageHeader } from "@/components/ui-kit";
import { requireClientPageSession } from "@/lib/auth/session";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Emitir NFS-e" };

export default async function IssuePage() {
  const demoMock = process.env.NFSE_PROVIDER === "mock" && !process.env.NEXT_PUBLIC_SUPABASE_URL;
  let customers: IssueCustomer[] = [];
  let services: IssueService[] = [];

  if (demoMock) {
    customers = [{ id: "00000000-0000-4000-8000-000000000201", legalName: "Tomador de demonstração" }];
    services = [{ id: "00000000-0000-4000-8000-000000000102", name: "Serviço de demonstração", defaultDescription: "Serviço de demonstração." }];
  } else {
    const session = await requireClientPageSession();
    const admin = createAdminClient();
    const [customersResult, servicesResult] = await Promise.all([
      admin.from("customers").select("id,legal_name,tax_id").eq("organization_id", session.organizationId).order("legal_name"),
      admin
        .from("service_templates")
        .select(
          "id,name,default_description,active,workflow_status,national_service_code_id,national_tax_code,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,nbs_code,iss_taxation,iss_rate_source,fiscal_reference,reviewed_at,reviewed_by",
        )
        .eq("organization_id", session.organizationId)
        .eq("workflow_status", "REVIEWED")
        .eq("active", true)
        .not("reviewed_at", "is", null)
        .not("reviewed_by", "is", null)
        .order("name"),
    ]);

    customers = (customersResult.data ?? []).map((item) => ({
      id: item.id,
      legalName: item.legal_name,
      taxId: item.tax_id,
    }));
    services = (servicesResult.data ?? [])
      .filter((service) => getServiceReadiness(service).ready)
      .map(({ id, name, default_description }) => ({ id, name, defaultDescription: default_description }));
  }

  return (
    <div className="page v2-page">
      {demoMock && <MockBanner />}
      <PageHeader
        title="Emitir NFS-e"
        description="Preencha os dados da operação. A configuração fiscal permanece protegida no backend."
      />
      <IssueForm customers={customers} services={services} mock={demoMock} />
    </div>
  );
}
