# Arquitetura

## Visão geral

- Next.js 16 App Router, React 19, TypeScript e Tailwind CSS.
- Server Components para leitura e shell; Client Components somente nos fluxos interativos.
- Route Handlers Node.js para emissão, XML, certificado, criptografia e futura comunicação mTLS.
- Supabase Auth em cookies via `@supabase/ssr`, PostgreSQL com RLS e Storage privado.
- `MockNFSeProvider` funcional e `NationalNFSeProvider` isolado/fail-closed.

## Limites

`src/lib/nfse` é a única camada autorizada a conhecer SEFIN, DPS, XSD, certificado, assinatura, parâmetros municipais ou reconciliação. Páginas React recebem estados e mensagens humanas, nunca regras fiscais.

Fluxo de emissão alvo:

1. sessão e membership;
2. organização apta;
3. idempotência;
4. reserva transacional do número DPS;
5. template + perfil fiscal + parâmetros municipais;
6. domínio fiscal;
7. XML/XSD + assinatura;
8. transmissão mTLS;
9. persistência e auditoria;
10. `UNKNOWN` segue para reconciliação, sem reenvio automático.

No modo mock, o mesmo contrato exercita sucesso, rejeição e resultado incerto sem produzir documento fiscal real.
