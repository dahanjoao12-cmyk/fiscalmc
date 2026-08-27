# Certificado A1

O upload ocorre apenas em Route Handler Node.js com limite de 5 MB. A extensão `.pfx`/`.p12` é conferida, mas a aceitação real depende de o conteúdo abrir como PKCS#12. O backend valida senha e vigência, extrai metadados seguros e exige que o CNPJ extraído do certificado corresponda ao CNPJ canônico da organization antes de armazenar o arquivo.

A senha é protegida por AES-256-GCM com IV aleatório e autenticação. `CERTIFICATE_MASTER_KEY` tem 32 bytes em base64, é diferente por ambiente e existe somente nos secrets do deploy. O PFX nunca possui política de download para usuários.

O bucket privado existente é `a1-certificates`; os objetos usam `organizations/{organizationId}/certificates/{certificateId}.p12`. Não há política de leitura para usuários e nenhum endpoint devolve PFX, senha, PEM ou caminho privado. A descriptografia ocorre apenas em memória e pelo tempo necessário à assinatura/mTLS; não são usados arquivos temporários.

`digital_certificates` mantém histórico: só há um registro `CURRENT` (`replaced_at IS NULL`) por organization. A substituição valida e sobe o novo PFX antes de executar a troca transacional no banco. Certificados em até 30 dias do vencimento ficam em `EXPIRING`: são utilizáveis, mas exibem alerta. Certificados expirados, inválidos, revogados ou com CNPJ divergente falham fechados.

O mesmo `CertificateProvider` fornece o material para XMLDSIG e mTLS. `LocalCertificateProvider` usa `NFSE_CERT_PATH`/`NFSE_CERT_PASSWORD` somente em desenvolvimento e smoke tests; `OrganizationCertificateProvider` nunca faz fallback para ele.

Para escala, migrar a chave mestra para envelope encryption com KMS/HSM e rotação versionada.
