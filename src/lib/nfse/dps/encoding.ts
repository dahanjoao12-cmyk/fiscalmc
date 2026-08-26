import { gzipSync, gunzipSync } from "node:zlib";

export function encodeDpsForSefin(xml:string){return gzipSync(Buffer.from(xml,"utf8")).toString("base64");}
export function decodeDpsFromSefin(value:string){return gunzipSync(Buffer.from(value,"base64")).toString("utf8");}
