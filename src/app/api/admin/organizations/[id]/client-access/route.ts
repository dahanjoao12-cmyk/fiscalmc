import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { can } from "@/lib/security/authorization";
import { ClientAccessError, createClientAccessService } from "@/lib/auth/client-access-service";
import { passwordConfirmationSchema } from "@/lib/auth/client-access-model";

export const runtime = "nodejs";

const organizationIdSchema = z.string().uuid();
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("BLOCK") }),
  z.object({ action: z.literal("REACTIVATE") }),
  z.object({ action: z.literal("RESET_PASSWORD"), password: z.string(), confirmPassword: z.string() }),
]);

function responseFor(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Revise os dados informados." }, { status: 400 });
  if (error instanceof ClientAccessError) {
    if (error.code === "ORGANIZATION_NOT_FOUND" || error.code === "CLIENT_ACCESS_NOT_FOUND") return NextResponse.json({ error: "Acesso do cliente não encontrado." }, { status: 404 });
    if (error.code === "CLIENT_ACCESS_ALREADY_EXISTS") return NextResponse.json({ error: "Esta empresa já possui um acesso principal." }, { status: 409 });
    if (error.code === "PASSWORD_INVALID") return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 422 });
    if (error.code === "INVALID_ORGANIZATION_CNPJ") return NextResponse.json({ error: "O CNPJ da empresa precisa ser revisado antes de criar o acesso." }, { status: 422 });
  }
  return NextResponse.json({ error: "Não foi possível atualizar o acesso do cliente." }, { status: 422 });
}

async function authorize(permission: "client-access:read" | "client-access:write") {
  const session = await requireOfficeSession();
  if (!can(session.role, permission)) throw new Error("FORBIDDEN_CLIENT_ACCESS");
  return session;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorize("client-access:read");
    const { id } = await params;
    organizationIdSchema.parse(id);
    return NextResponse.json(await createClientAccessService().getSummary(id));
  } catch (error) {
    if (error instanceof Error && ["FORBIDDEN_CLIENT_ACCESS", "FORBIDDEN_OFFICE", "UNAUTHENTICATED"].includes(error.message)) return NextResponse.json({ error: "Acesso do escritório necessário." }, { status: 403 });
    return responseFor(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize("client-access:write");
    const { id } = await params;
    organizationIdSchema.parse(id);
    const input = passwordConfirmationSchema.parse(await request.json());
    const result = await createClientAccessService().create({ organizationId: id, password: input.password, actorUserId: session.userId });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["FORBIDDEN_CLIENT_ACCESS", "FORBIDDEN_OFFICE", "UNAUTHENTICATED"].includes(error.message)) return NextResponse.json({ error: "Seu perfil não pode criar acessos." }, { status: 403 });
    return responseFor(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize("client-access:write");
    const { id } = await params;
    organizationIdSchema.parse(id);
    const input = patchSchema.parse(await request.json());
    const service = createClientAccessService();
    const result = input.action === "BLOCK"
      ? await service.block({ organizationId: id, actorUserId: session.userId })
      : input.action === "REACTIVATE"
        ? await service.reactivate({ organizationId: id, actorUserId: session.userId })
        : await service.resetPassword({ organizationId: id, actorUserId: session.userId, password: passwordConfirmationSchema.parse(input).password });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && ["FORBIDDEN_CLIENT_ACCESS", "FORBIDDEN_OFFICE", "UNAUTHENTICATED"].includes(error.message)) return NextResponse.json({ error: "Seu perfil não pode alterar acessos." }, { status: 403 });
    return responseFor(error);
  }
}
