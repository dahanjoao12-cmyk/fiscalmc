# Moreira & Castro — Emissor de NFS-e

V1 web/PWA para emissão simplificada de NFS-e por clientes do escritório Moreira & Castro. A interface esconde decisões fiscais do cliente e mantém serviços, tributação, certificado A1 e ambiente sob controle administrativo.

## Rodar localmente

```bash
pnpm install
pnpm dev
```

Acesse `http://localhost:3000`. O ambiente local abre direto no painel e usa `MockNFSeProvider`, sem login e sem validade fiscal.

## Verificações

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

## Segurança operacional

- `NFSE_PROVIDER=mock` e `NFSE_ENV=production_restricted` são os padrões.
- Produção exige também `ENABLE_NFSE_PRODUCTION=true`; o adaptador nacional continua fail-closed até homologação.
- Nunca versione `.env`, PFX/P12, senhas ou chaves.
- O login fica dispensado apenas no modo local mock. Configure Supabase antes de qualquer uso externo.

Consulte [Arquitetura](docs/ARCHITECTURE.md), [Integração NFS-e](docs/NFSE_INTEGRATION.md), [Segurança](docs/SECURITY.md), [Referência visual](docs/design/README.md) e [Deploy Vercel](docs/VERCEL_DEPLOY.md).
