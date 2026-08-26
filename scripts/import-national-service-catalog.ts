import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

const sourceUrl="https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/anexo_b-nbs2-lista_servico_nacional-snnfse-prodrest-v1-01-20260122.xlsx";
const version="ANEXO_B-NBS2-LISTA_SERVICO_NACIONAL-SNNFSe-PRODREST-v1.01-20260122";
const file="schemas/nfse/production-restricted/ANEXO_B-NBS2-LISTA_SERVICO_NACIONAL-SNNFSe-PRODREST-v1.01-20260122.xlsx";
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"",textNodeName:"#text",trimValues:false});
const entry=(name:string)=>execFileSync("tar",["-xOf",file,name],{encoding:"utf8"});
const text=(value:unknown):string=>typeof value==="string"?value:typeof value==="object"&&value!==null&&"#text" in value?String(value["#text"]):"";
const values=(cell:Record<string,unknown>,strings:string[])=>cell.t==="s"?strings[Number(cell.v)]:String(cell.v??"");
const column=(reference:string)=>reference.replace(/\d/g,"");
async function main(){const shared=parser.parse(entry("xl/sharedStrings.xml"));const strings=(shared.sst.si as Record<string,unknown>[]).map(item=>item.t?text(item.t):(Array.isArray(item.r)?item.r:[item.r]).map(run=>text((run as Record<string,unknown>).t)).join(""));const sheet=parser.parse(entry("xl/worksheets/sheet1.xml"));const rows=sheet.worksheet.sheetData.row as Record<string,unknown>[];const catalog=new Map<string,{code:string;display_code:string;item:string;subitem:string|null;national_split:string|null;description:string}>();for(const row of rows.slice(1)){const cells=Array.isArray(row.c)?row.c as Record<string,unknown>[]:[row.c as Record<string,unknown>];const current=Object.fromEntries(cells.map(cell=>[column(String(cell.r)),values(cell,strings)]));if(!/^\d{1,6}$/.test(current.A??"")||!(current.E??"").trim())continue;const code=current.A.padStart(6,"0");catalog.set(code,{code,display_code:`${code.slice(0,2)}.${code.slice(2,4)}.${code.slice(4)}`,item:current.B??"",subitem:current.C||null,national_split:current.D||null,description:current.E.trim()});}const sourceHash=createHash("sha256").update(await readFile(file)).digest("hex");const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});const records=[...catalog.values()].map(item=>({...item,active:true,valid_from:"2026-01-22",valid_until:null,source:"NFSE_NACIONAL",source_version:version,source_hash:sourceHash}));for(let index=0;index<records.length;index+=100){const{error}=await db.from("national_service_codes").upsert(records.slice(index,index+100),{onConflict:"code"});if(error)throw error;}console.log(JSON.stringify({imported:records.length,source:sourceUrl,version,sha256:sourceHash},null,2));}
void main();
