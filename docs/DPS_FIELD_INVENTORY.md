# Inventário DPS — Produção Restrita v1.01

Fonte: `ANEXO_I-SEFIN_ADN-DPS_NFSe-SNNFSe-PRODREST-v1.01-20260209` e
`NFSe-ESQUEMAS_XSD-PRODREST-v1.01-20260727` (ver `schemas/nfse/production-restricted/manifest.json`).

| Campo DPS | Origem | Obrigatoriedade | Status |
| --- | --- | --- | --- |
| `infDPS/@Id`, `serie`, `nDPS` | sequência DPS + identificador oficial | obrigatório | implementado no modelo |
| `tpAmb`, `dhEmi`, `verAplic`, `dCompet`, `tpEmit`, `cLocEmi` | ambiente bloqueado, operação e organização | obrigatório | implementado no modelo |
| `prest/*`, `regTrib/*` | organization + tax_profile.dps_configuration | obrigatório | bloqueia se ausente |
| `toma/*` | customer | condicional | mapeado para CPF/CNPJ/NIF e endereço quando informado |
| `serv/locPrest`, `cServ/*` | service_template + operação + FiscalRuleResolver | obrigatório | bloqueia se ausente |
| `valores/vServPrest` | invoice | obrigatório | implementado |
| `trib/tribMun` | FiscalRuleResolver + tax_profile.dps_configuration | obrigatório | bloqueia se retenção/regime técnico não estiver definido |
| `trib/tribFed` | tax_profile.dps_configuration | condicional | não é inferido |
| `totTrib` | tax_profile.dps_configuration | obrigatório | requer indicador/configuração explícita |
| `IBSCBS` | classificação e parâmetros oficiais IBS/CBS | condicional no XSD | omitido somente quando o cenário não o exige; cenário parametrizado sem dados bloqueia |
| deduções, benefícios, imunidade, exigibilidade suspensa | parâmetros municipais + configuração revisada | condicional | não é inferido; cenário aplicável sem parâmetros bloqueia |

Os campos ausentes não recebem texto, código ou alíquota fictícia. A integração nacional segue bloqueada até a validação controlada posterior.

Antes do `DpsModel`, `assertDpsReadiness()` valida organização, serviço, tomador, configuração fiscal e, no smoke controlado, a disponibilidade do A1. A validação não cria valores padrão e bloqueia a cadeia antes de gerar XML.
