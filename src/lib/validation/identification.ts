export function normalizeTaxId(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }

export function isValidCpf(value: string) {
  const cpf = normalizeTaxId(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (base:string, factor:number) => { let sum=0; for (const char of base) sum += Number(char) * factor--; return ((sum * 10) % 11) % 10; };
  return digit(cpf.slice(0,9),10) === Number(cpf[9]) && digit(cpf.slice(0,10),11) === Number(cpf[10]);
}

// CNPJ alfanumérico: 12 posições base36 + 2 dígitos numéricos, conforme Receita Federal.
export function isValidCnpj(value: string) {
  const cnpj = normalizeTaxId(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) return false;
  const weights = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const numericValue = (char:string) => char.charCodeAt(0) - 48;
  const check = (base:string) => { const aligned = weights.slice(weights.length - base.length); const sum = [...base].reduce((total,char,index) => total + numericValue(char) * aligned[index],0); const mod = sum % 11; return mod < 2 ? 0 : 11 - mod; };
  const d1 = check(cnpj.slice(0,12)); const d2 = check(cnpj.slice(0,12) + d1);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function isValidTaxId(value:string) { const normalized=normalizeTaxId(value); return normalized.length === 11 ? isValidCpf(normalized) : isValidCnpj(normalized); }
