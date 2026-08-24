import { NextResponse } from "next/server";
import { z } from "zod";
import { buildFiscalDocument } from "@/lib/nfse/issuance/domain";
import { getNFSeProvider } from "@/lib/nfse/issuance/provider";
import { parseMoneyToCents } from "@/lib/validation/money";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { logEvent } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ organizationId:z.uuid(), serviceTemplateId:z.uuid(), customerId:z.uuid(), amount:z.union([z.string(),z.number()]), serviceDate:z.iso.date(), description:z.string().trim().min(3).max(1000), scenario:z.enum(["success","rejection","timeout"]).optional() });
const completed = new Map<string, unknown>();
let nextDps = 13n;

export async function POST(request:Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length < 16) return NextResponse.json({ error:"Chave de idempotência ausente ou inválida." },{ status:400 });
  const cached = completed.get(idempotencyKey); if (cached) return NextResponse.json(cached,{ headers:{ "X-Idempotent-Replay":"true", "X-Request-ID":requestId } });
  try {
    assertRateLimit(`issue:${request.headers.get("x-forwarded-for") ?? "local"}`);
    const body = schema.parse(await request.json());
    // Em produção, organizationId é substituído pelo tenant da sessão e validado por membership/RLS.
    const document = buildFiscalDocument({ organizationId:body.organizationId, amountCents:parseMoneyToCents(body.amount), serviceDate:body.serviceDate, description:body.description, dpsNumber:nextDps++ });
    logEvent("info","INVOICE_REQUESTED",{ requestId, organizationId:body.organizationId, idempotencyKey });
    const result = await getNFSeProvider().issue({ document, idempotencyKey, scenario:body.scenario });
    if (result.status === "REJECTED") { logEvent("warn","INVOICE_REJECTED",{requestId,code:result.code}); return NextResponse.json({ status:result.status, safeMessage:result.safeMessage },{ status:422, headers:{"X-Request-ID":requestId} }); }
    const payload = { ...result, invoiceId:result.status === "ISSUED" ? result.nfseNumber.padStart(11,"0") : undefined };
    completed.set(idempotencyKey,payload);
    logEvent("info",result.status === "ISSUED" ? "INVOICE_ISSUED" : "INVOICE_UNKNOWN",{requestId,status:result.status});
    return NextResponse.json(payload,{ status:result.status === "UNKNOWN" ? 202 : 201, headers:{"X-Request-ID":requestId} });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error:"Revise os dados informados.", fields:error.flatten().fieldErrors },{status:400,headers:{"X-Request-ID":requestId}});
    if (error instanceof Error && error.message === "RATE_LIMITED") return NextResponse.json({ error:"Muitas tentativas. Aguarde um minuto e tente novamente." },{status:429,headers:{"X-Request-ID":requestId}});
    logEvent("error","INVOICE_REQUEST_FAILED",{requestId,error:error instanceof Error ? error.message : "unknown"});
    return NextResponse.json({ error:"Não foi possível concluir a emissão. Informe o código de atendimento ao escritório.", requestId },{status:500,headers:{"X-Request-ID":requestId}});
  }
}
