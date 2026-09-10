import "server-only";
import { XMLParser } from "fast-xml-parser";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Values = Record<string, string>;
function collect(value: unknown, values: Values) {
  if (Array.isArray(value)) value.forEach((item) => collect(item, values));
  else if (value && typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    if (typeof child === "string" || typeof child === "number") values[key.toLowerCase()] ??= String(child);
    else collect(child, values);
  });
}
function first(values: Values, ...names: string[]) { return names.map((name) => values[name.toLowerCase()]).find(Boolean) ?? "—"; }

type XmlNode = Record<string, unknown>;
function node(value: unknown): XmlNode { return value && typeof value === "object" && !Array.isArray(value) ? value as XmlNode : {}; }
function scalar(value: unknown): string | undefined { return typeof value === "string" || typeof value === "number" ? String(value) : undefined; }

export async function buildAuthorizedNfseAuxiliaryPdf(input: { xml: Uint8Array; invoice: { nfseNumber?: string | null; accessKey?: string | null; serviceDate: string; amountCents: number; description: string } }) {
  const parsed = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(Buffer.from(input.xml).toString("utf8"));
  const values: Values = {}; collect(parsed, values);
  // Prestador (emit) and Tomador (DPS.infDPS.toma) share tag names (CNPJ, xNome),
  // so the flattened map above can't tell them apart — read each directly instead.
  const infNFSe = node(node(parsed.NFSe).infNFSe);
  const emit = node(infNFSe.emit);
  const toma = node(node(node(infNFSe.DPS).infDPS).toma);
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.15, 0.25); const orange = rgb(0.84, 0.31, 0.03); let y = 790;
  const line = (label: string, value: string) => { page.drawText(label, { x: 48, y, size: 9, font: bold, color: navy }); page.drawText(value.slice(0, 100), { x: 180, y, size: 9, font: regular, color: navy }); y -= 21; };
  page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: navy }); page.drawText("PDF DA NOTA", { x: 48, y: 810, size: 18, font: bold, color: rgb(1, 1, 1) }); page.drawText("Documento auxiliar gerado pelo FiscalMC", { x: 48, y: 794, size: 9, font: regular, color: rgb(0.86, 0.91, 0.95) });
  y = 750; line("NFS-e", input.invoice.nfseNumber ?? first(values, "nNFSe", "numero")); line("Chave de acesso", input.invoice.accessKey ?? first(values, "chaveAcesso", "chNFSe")); line("Emissão", first(values, "dhEmi", "dataEmissao", "dEmi"));
  y -= 8; page.drawRectangle({ x: 48, y, width: 4, height: 16, color: orange }); page.drawText("Prestador", { x: 62, y: y + 3, size: 12, font: bold, color: navy }); y -= 24; line("Nome", scalar(emit.xNome) ?? first(values, "xNome", "razaoSocial")); line("CNPJ", scalar(emit.CNPJ) ?? first(values, "CNPJPrest", "cnpj"));
  y -= 8; page.drawRectangle({ x: 48, y, width: 4, height: 16, color: orange }); page.drawText("Tomador", { x: 62, y: y + 3, size: 12, font: bold, color: navy }); y -= 24; line("Nome", scalar(toma.xNome) ?? "—"); line("CPF/CNPJ", scalar(toma.CNPJ) ?? scalar(toma.CPF) ?? "—");
  y -= 8; page.drawRectangle({ x: 48, y, width: 4, height: 16, color: orange }); page.drawText("Serviço", { x: 62, y: y + 3, size: 12, font: bold, color: navy }); y -= 24; line("Competência", input.invoice.serviceDate); line("Descrição", input.invoice.description); line("Valor", new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.invoice.amountCents / 100)); line("ISS", first(values, "vISSQN", "vIss", "iss"));
  page.drawText("PDF gerado a partir dos dados autorizados da NFS-e.", { x: 48, y: 42, size: 8, font: regular, color: rgb(0.3, 0.38, 0.45) });
  return Buffer.from(await pdf.save());
}
