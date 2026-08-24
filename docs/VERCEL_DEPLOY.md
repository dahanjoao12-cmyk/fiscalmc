# Deploy na Vercel

1. Crie um projeto Supabase e aplique `supabase/migrations` pelo CLI versionado.
2. Execute `supabase/seed.sql` somente em desenvolvimento. Os perfis fictícios não substituem usuários do Supabase Auth.
3. Importe o repositório na Vercel.
4. Cadastre `NEXT_PUBLIC_APP_URL`, chaves publicáveis do Supabase e secrets server-only conforme `.env.example`.
5. Mantenha `NFSE_PROVIDER=mock`, `NFSE_ENV=production_restricted` e `ENABLE_NFSE_PRODUCTION=false`.
6. Faça o primeiro deploy e valide `/api/health`, manifest/service worker e fluxos mobile/desktop.
7. Configure callbacks do Supabase Auth com o domínio temporário da Vercel.

Para domínio próprio, adicione `notas.dominio.com.br` na Vercel, atualize `NEXT_PUBLIC_APP_URL` e callbacks do Supabase. Nenhuma alteração estrutural é necessária.

Para homologação fiscal, inclua `CERTIFICATE_MASTER_KEY` exclusiva, faça upload seguro do A1, valide o XSD oficial vigente e mantenha produção bloqueada.
