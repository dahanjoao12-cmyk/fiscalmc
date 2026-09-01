import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({ municipalRegistration: z.string().trim().min(1).max(80) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOfficeSession();
    const [{ id }, input] = await Promise.all([params, inputSchema.parseAsync(await request.json())]);
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    const { data, error } = await createAdminClient().from("organizations").update({ municipal_registration: input.municipalRegistration }).eq("id", id).select("municipal_registration").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    return NextResponse.json({ municipalRegistration: data.municipal_registration });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Informe uma inscrição municipal válida." }, { status: 400 });
    return NextResponse.json({ error: "Não foi possível salvar a inscrição municipal." }, { status: 422 });
  }
}
