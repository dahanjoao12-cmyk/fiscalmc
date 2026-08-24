export const dynamic = "force-dynamic";
export function GET() { return Response.json({ status:"ok", provider:process.env.NFSE_PROVIDER ?? "mock", environment:process.env.NFSE_ENV ?? "production_restricted", timestamp:new Date().toISOString() },{ headers:{"Cache-Control":"no-store"} }); }
