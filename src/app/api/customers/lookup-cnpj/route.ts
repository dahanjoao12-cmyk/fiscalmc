import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionOrganization } from "@/lib/auth/session";
import { normalizeTaxId } from "@/lib/validation/identification";

export const runtime = "nodejs";

const brasilApiSchema = z.object({
  razao_social: z.string().nullable().optional(),
  logradouro: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  codigo_municipio_ibge: z.number().nullable().optional(),
  email: z.string().nullable().optional(),
  ddd_telefone_1: z.string().nullable().optional(),
  descricao_situacao_cadastral: z.string().nullable().optional(),
});

function formatPhone(raw?: string | null) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export async function GET(request: Request) {
  try {
    await requireSessionOrganization();
  } catch {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const cnpj = normalizeTaxId(new URL(request.url).searchParams.get("cnpj") ?? "");
  if (!/^\d{14}$/.test(cnpj)) return NextResponse.json({ error: "Informe um CNPJ com 14 dígitos." }, { status: 400 });

  let response: Response;
  try {
    response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { headers: { accept: "application/json" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o CNPJ agora. Tente novamente." }, { status: 502 });
  }
  if (response.status === 404) return NextResponse.json({ error: "CNPJ não encontrado." }, { status: 404 });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível consultar o CNPJ agora. Tente novamente." }, { status: 502 });

  const parsed = brasilApiSchema.safeParse(await response.json());
  if (!parsed.success) return NextResponse.json({ error: "Resposta inesperada da consulta de CNPJ." }, { status: 502 });

  const municipalityCode = parsed.data.codigo_municipio_ibge ? String(parsed.data.codigo_municipio_ibge) : "";
  return NextResponse.json({
    customer: {
      legalName: parsed.data.razao_social ?? "",
      street: parsed.data.logradouro ?? "",
      addressNumber: parsed.data.numero ?? "",
      addressComplement: parsed.data.complemento ?? "",
      neighborhood: parsed.data.bairro ?? "",
      postalCode: (parsed.data.cep ?? "").replace(/\D/g, ""),
      municipalityCode: /^\d{7}$/.test(municipalityCode) ? municipalityCode : "",
      state: parsed.data.uf ?? "",
      email: parsed.data.email ?? "",
      phone: formatPhone(parsed.data.ddd_telefone_1),
      situacaoCadastral: parsed.data.descricao_situacao_cadastral ?? "",
    },
  });
}
