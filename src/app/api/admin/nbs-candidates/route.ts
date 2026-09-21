import { NextResponse } from "next/server";
import { requireOfficeSession } from "@/lib/auth/session";
import { searchNbsCatalog } from "@/lib/organizations/nbs-activity-resolver";

export async function GET(request: Request) {
  try {
    await requireOfficeSession();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({ candidates: searchNbsCatalog(q) });
  } catch {
    return NextResponse.json({ error: "Não foi possível pesquisar o catálogo de NBS." }, { status: 403 });
  }
}
