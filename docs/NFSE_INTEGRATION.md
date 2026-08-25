# Integração com a NFS-e Nacional

## Estado real em 24/08/2026

| Camada | Estado |
|---|---|
| Mock | Implementado e testável localmente |
| Produção Restrita | Estrutura preparada; não homologada sem A1/credenciais/XSD fixado |
| Produção | Bloqueada por código e variável de ambiente |

Não há alegação de integração nacional concluída. `NationalNFSeProvider` falha de forma segura até a homologação.

## Fontes oficiais consultadas

- Portal Nacional, “APIs - Prod. Restrita e Produção”, atualizado em 20/08/2026: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
- Manual dos Contribuintes/Emissor Público Nacional API v1.2 (outubro/2025): https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf/@@download/file
- Swagger SEFIN Produção Restrita: https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index
- Swagger SEFIN Produção: https://sefin.nfse.gov.br/SefinNacional/docs/index
- Parâmetros municipais restrita: https://adn.producaorestrita.nfse.gov.br/parametrizacao/docs/index.html
- DANFSe restrita atual: https://adn.producaorestrita.nfse.gov.br/danfse/docs/index.html
- Nota Técnica 008/2026 e notícia oficial de 30/06/2026: https://www.gov.br/nfse/pt-br/noticias/se-cgnfs-e-prorroga-o-prazo-para-adequacao-ao-novo-leiaute-do-danfse
- CNPJ alfanumérico/Receita Federal: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico

## Contratos confirmados no manual

- `POST /nfse`: recepção síncrona da DPS e retorno da NFS-e ou rejeição.
- `GET /nfse/{chaveAcesso}`: consulta por chave.
- `GET /dps/{id}`: recupera chave correspondente à DPS, sujeito à identidade do certificado.
- `HEAD /dps/{id}`: verifica existência, base da reconciliação após timeout.
- Parâmetros municipais: convênio, serviço, retenções e benefícios.
- Comunicação REST/JSON, documento fiscal XML assinado e autenticação mútua por certificado.

## Decisões

- A API antiga de DANFSe foi descontinuada em 15/07/2026; somente a API/documentação atual será usada.
- O identificador fiscal é `text`, normalizado em maiúsculas e preparado para 12 posições alfanuméricas + 2 DVs.
- IBS/CBS não é inferido. Os grupos e regras só entram após importação do pacote oficial vigente e parametrização determinística.
- XSDs não são copiados de GitHub nem de pacotes antigos. Antes da homologação: baixar do portal oficial, registrar nome/versão/data/SHA-256, gerar fixtures válidas e validar localmente.

## Pendente para homologação

1. empresa real autorizada e aderente ao emissor nacional;
2. certificado A1 válido e senha fornecidos por canal seguro;
3. pacote XSD oficial vigente no dia do teste, com checksum;
4. confirmação do contrato do Swagger com mTLS;
5. testes de DPS, assinatura, parâmetros, consulta/reconciliação e DANFSe no ambiente restrito.

## Smoke de parâmetros municipais no Windows

Com Node.js instalado, execute:

```bash
pnpm nfse:test-municipal-parameters -- 3304557 07.02.01.001 2026-08-25
pnpm nfse:test-municipal-tls
```

Para mTLS, configure somente no `.env.local` (fora do repositório): `NFSE_CERT_PATH` com o caminho absoluto do arquivo `.pfx`/`.p12` e `NFSE_CERT_PASSWORD` com a senha. Em seguida execute `pnpm nfse:test-certificate` e `pnpm nfse:test-mtls`. O cliente usa validação TLS normal (`rejectUnauthorized: true`) e nunca escreve material do certificado em disco ou logs.

O primeiro comando usa o mesmo `MunicipalParametersProvider` da aplicação, imprime a URL, versão do Node e status HTTP, e valida a resposta JSON antes de exibir somente município, serviço, competência, incidência, alíquota e vigência. O segundo compara `node:https` com `fetch`/Undici. Nenhum dos dois transmite DPS, imprime secrets, relaxa TLS ou habilita Produção.
