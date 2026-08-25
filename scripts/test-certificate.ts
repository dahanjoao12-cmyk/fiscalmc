import { LocalCertificateProvider } from "../src/lib/nfse/certificate/local-provider";

const result=await new LocalCertificateProvider().validate();
if(result.status!=="VALID" || !result.metadata) { console.error(`Certificate loaded: ${result.status}`); process.exitCode=1; }
else { console.log("Certificate loaded: OK"); console.log(`Subject: ${result.metadata.subject}`); console.log(`Issuer: ${result.metadata.issuer}`); console.log(`Valid from: ${result.metadata.validFrom}`); console.log(`Valid until: ${result.metadata.validUntil}`); }
