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
