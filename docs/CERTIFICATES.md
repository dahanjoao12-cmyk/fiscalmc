# Certificado A1

O upload deve ocorrer em Route Handler Node.js com limite de 5 MB e MIME/extensão permitidos. O backend abre o PFX/P12, valida senha e vigência, extrai apenas metadados, verifica o titular e então armazena o arquivo em bucket privado.

A senha é protegida por AES-256-GCM com IV aleatório e autenticação. `CERTIFICATE_MASTER_KEY` tem 32 bytes em base64, é diferente por ambiente e existe somente nos secrets do deploy. O PFX nunca possui política de download para usuários.

Nenhum endpoint devolve PFX, senha ou chave privada. A descriptografia ocorre apenas em memória e pelo tempo necessário à assinatura/mTLS. Arquivos temporários devem ser removidos em `finally`.

Para escala, migrar a chave mestra para envelope encryption com KMS/HSM e rotação versionada.
