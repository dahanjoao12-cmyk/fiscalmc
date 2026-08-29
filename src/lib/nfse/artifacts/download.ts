import "server-only";
import { artifactDownloadName, FISCAL_ARTIFACTS_BUCKET, type FiscalArtifact, type FiscalArtifactType } from "./model";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAuthorizedFiscalArtifact(input: { invoiceId: string; organizationId: string; artifactType: FiscalArtifactType }) {
  const db = createAdminClient();
  const { data: artifact } = await db.from("fiscal_artifacts").select("id,invoice_id,organization_id,artifact_type,source,private_storage_path,content_type,checksum_sha256,created_at").eq("invoice_id", input.invoiceId).eq("organization_id", input.organizationId).eq("artifact_type", input.artifactType).maybeSingle();
  return artifact as FiscalArtifact | null;
}

export async function downloadAuthorizedFiscalArtifact(input: { invoiceId: string; organizationId: string; artifactType: FiscalArtifactType; nfseNumber?: string | null }) {
  const artifact = await getAuthorizedFiscalArtifact(input);
  if (!artifact) return null;
  const { data, error } = await createAdminClient().storage.from(FISCAL_ARTIFACTS_BUCKET).download(artifact.private_storage_path);
  if (error || !data) throw new Error("FISCAL_ARTIFACT_DOWNLOAD_FAILED");
  return { artifact, body: data, filename: artifactDownloadName({ ...artifact, invoiceId: input.invoiceId, nfseNumber: input.nfseNumber }) };
}
