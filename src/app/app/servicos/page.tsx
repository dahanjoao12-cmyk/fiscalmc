import { redirect } from "next/navigation";
import { ClientServiceManager, type ClientService } from "@/components/client-service-manager";
import { PageHeader } from "@/components/ui-kit";
import { requireClientPageSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ClientServicesPage() {
  const session = await requireClientPageSession();
  if (session.role !== "CLIENT_USER") redirect("/app?notice=client");
  const db = createAdminClient();
  const servicesResult = await db.from("service_templates").select("id,name,default_description,client_service_location,client_note,needs_info_message,workflow_status,created_at,updated_at").eq("organization_id", session.organizationId).order("updated_at", { ascending: false });
  const services = (servicesResult.data ?? []) as ClientService[];
  return <div className="page v2-page">
    <PageHeader title="Meus serviços" description="Você informa o que sua empresa presta; o escritório valida a parte fiscal." />
    <ClientServiceManager initialServices={services} />
  </div>;
}
