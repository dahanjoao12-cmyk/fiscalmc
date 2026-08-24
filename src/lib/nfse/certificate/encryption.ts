import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type Envelope = { version:1; iv:string; tag:string; ciphertext:string };
function masterKey(){const encoded=process.env.CERTIFICATE_MASTER_KEY;if(!encoded)throw new Error("CERTIFICATE_MASTER_KEY não configurada.");const key=Buffer.from(encoded,"base64");if(key.length!==32)throw new Error("CERTIFICATE_MASTER_KEY deve ter exatamente 32 bytes em base64.");return key;}
export function encryptSecret(input:Buffer):Envelope{const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",masterKey(),iv);const ciphertext=Buffer.concat([cipher.update(input),cipher.final()]);return{version:1,iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),ciphertext:ciphertext.toString("base64")};}
export function decryptSecret(input:Envelope){const decipher=createDecipheriv("aes-256-gcm",masterKey(),Buffer.from(input.iv,"base64"));decipher.setAuthTag(Buffer.from(input.tag,"base64"));return Buffer.concat([decipher.update(Buffer.from(input.ciphertext,"base64")),decipher.final()]);}
