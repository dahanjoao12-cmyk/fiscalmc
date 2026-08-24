# Banco de dados

A migration inicial cria perfis, organizações, memberships, perfis fiscais, serviços, tomadores, certificados, sequências DPS, notas, tentativas, auditoria, cache municipal e solicitações de cancelamento.

Constraints relevantes:

- CNPJ como texto alfanumérico de 14 posições;
- tomador único por tenant + identificação;
- idempotency key única por tenant;
- número DPS único por tenant + ambiente + série;
- chave de acesso única por ambiente;
- uma credencial A1 corrente por organização;
- índices parciais para serviços ativos, certificados e notas `UNKNOWN`.

RLS é defesa em profundidade; mutations fiscais sensíveis devem continuar no backend. Rode `supabase db advisors` e testes pgTAP/RLS antes de cada release.
