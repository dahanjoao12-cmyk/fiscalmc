/** Client-safe formatting of the stored X.509 subject; it does not validate ownership. */
export function certificateHolderName(subject:string){
  const commonName=subject.match(/(?:^|,\s*)CN=([^,]+)/i)?.[1]?.trim();
  if(!commonName)return "Titular não identificado";
  return commonName.replace(/:\d{14}$/," ").trim()||"Titular não identificado";
}
