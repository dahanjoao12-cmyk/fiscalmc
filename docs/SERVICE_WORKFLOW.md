# Workflow de serviços

O cadastro comercial e a classificação fiscal são responsabilidades separadas.

## Responsabilidades

- O `CLIENT_USER` informa nome, descrição, local habitual da prestação em linguagem humana e uma observação opcional.
- O backend deriva `organization_id` exclusivamente da sessão do cliente.
- O escritório relaciona o serviço ao catálogo nacional e ao de/para municipal, informa os campos técnicos exigidos pelo domínio e conclui a revisão.
- Nenhum serviço entra na emissão sem `workflow_status = REVIEWED`, `active = true`, revisão auditável e `getServiceReadiness().ready = true`.

## Estados

- `DRAFT`: rascunho comercial ainda não enviado.
- `PENDING_REVIEW`: enviado pelo cliente ou aguardando nova revisão.
- `NEEDS_INFO`: o escritório solicitou uma informação operacional adicional.
- `REVIEWED`: classificação fiscal concluída e ativa.
- `INACTIVE`: indisponível para emissão.

Uma alteração comercial material feita pelo cliente em um serviço revisado limpa a revisão atual, desativa o serviço e o devolve para `PENDING_REVIEW`. O evento `service_review_reset` preserva o histórico da mudança.

## Proteção dos campos fiscais

Os endpoints do cliente usam schemas Zod estritos e não aceitam códigos ou identificadores fiscais. O local comercial (`client_service_location`) é separado do código IBGE técnico (`service_location_municipality_code`). A migration também restringe o `SELECT` autenticado de `service_templates` a colunas comerciais seguras. Catálogo nacional e mappings municipais permanecem restritos ao escritório.

## Migration

Aplicar `20260828131258_service_workflow.sql` de forma incremental antes de disponibilizar as novas telas. A migration não recria a tabela e faz backfill conservador: somente serviços antigos ativos com `reviewed_at` e `reviewed_by` tornam-se `REVIEWED`.

Esta etapa não altera o provider de emissão, não habilita Produção Restrita e não executa `POST /nfse`.
