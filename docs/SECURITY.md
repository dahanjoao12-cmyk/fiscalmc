# Segurança

- RLS habilitada em todas as tabelas públicas; policies usam membership e tenant.
- `organizationId` do cliente nunca é autoridade. Em produção, o backend deriva o tenant da sessão e valida membership/RLS.
- Funções `SECURITY DEFINER` ficam no schema privado, têm `search_path=''`, checam `auth.uid()` e revogam execução pública.
- Storage de XML/PDF e A1 é privado; documentos usam acesso autenticado/URLs temporárias. Certificados não têm policy de leitura.
- Chave secret/service role e master key são server-only.
- CSP, frame denial, MIME sniffing e permissions policy são emitidos pelo Next.js.
- Zod valida endpoints; emissão usa idempotência, rate limiting e número DPS transacional.
- Logs estruturados têm request ID e removem chaves como senha, segredo, certificado, PFX, XML e payload.
- Audit logs são somente leitura para pessoal autorizado e não aceitam metadados com campos sensíveis conhecidos.

Antes de liberar externamente: configurar Supabase, remover o bypass local, executar testes RLS com dois tenants, rodar advisors do Supabase e revisar dependências.
