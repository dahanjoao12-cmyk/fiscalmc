import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTechnicalClientEmail, getClientAccessReadiness, normalizeClientCnpj, passwordSchema } from "./client-access-model";

export type ClientAccessErrorCode = "ORGANIZATION_NOT_FOUND" | "INVALID_ORGANIZATION_CNPJ" | "CLIENT_ACCESS_ALREADY_EXISTS" | "CLIENT_ACCESS_NOT_FOUND" | "AUTH_USER_CREATION_FAILED" | "CLIENT_ACCESS_PERSIST_FAILED" | "CLIENT_ACCESS_UPDATE_FAILED" | "PASSWORD_INVALID";
export class ClientAccessError extends Error {
  constructor(readonly code: ClientAccessErrorCode) { super(code); }
}

type OrganizationRecord = { id: string; legalName: string; taxId: string };
type AccessRecord = {
  organizationId: string;
  userId: string;
  technicalEmail: string;
  enabled: boolean;
  createdAt: string;
  blockedAt: string | null;
  membership: { active: boolean; role: string } | null;
  authUserActive: boolean;
};

export type ClientAccessSummary = {
  cnpj: string;
  status: "ACTIVE" | "BLOCKED" | "INVALID";
  createdAt: string;
  blockedAt: string | null;
};

export interface ClientAccessGateway {
  getOrganization(id: string): Promise<OrganizationRecord | null>;
  getAccess(organizationId: string): Promise<AccessRecord | null>;
  createAuthUser(input: { email: string; password: string; fullName: string; organizationId: string }): Promise<string>;
  registerAccess(input: { organization: OrganizationRecord; userId: string; technicalEmail: string; actorUserId: string }): Promise<void>;
  cleanupFailedRegistration(organizationId: string, userId: string): Promise<void>;
  updateAuthUser(userId: string, attributes: { password?: string; ban_duration?: string }): Promise<void>;
  setAccessState(input: { organizationId: string; userId: string; enabled: boolean; actorUserId: string }): Promise<void>;
  recordPasswordReset(input: { organizationId: string; userId: string; actorUserId: string }): Promise<void>;
}

export class ClientAccessService {
  constructor(private readonly gateway: ClientAccessGateway) {}

  async getSummary(organizationId: string) {
    const organization = await this.gateway.getOrganization(organizationId);
    if (!organization) throw new ClientAccessError("ORGANIZATION_NOT_FOUND");
    const access = await this.gateway.getAccess(organizationId);
    if (!access) return { access: null, readiness: getClientAccessReadiness({ access: null, membership: null, authUserActive: false }) };
    const readiness = getClientAccessReadiness({ access, membership: access.membership, authUserActive: access.authUserActive });
    const summary: ClientAccessSummary = {
      cnpj: organization.taxId,
      status: readiness.status === "ACTIVE" ? "ACTIVE" : readiness.status === "BLOCKED" ? "BLOCKED" : "INVALID",
      createdAt: access.createdAt,
      blockedAt: access.blockedAt,
    };
    return { access: summary, readiness };
  }

  async create(input: { organizationId: string; password: string; actorUserId: string }) {
    const parsedPassword = passwordSchema.safeParse(input.password);
    if (!parsedPassword.success) throw new ClientAccessError("PASSWORD_INVALID");
    const organization = await this.gateway.getOrganization(input.organizationId);
    if (!organization) throw new ClientAccessError("ORGANIZATION_NOT_FOUND");
    if (!normalizeClientCnpj(organization.taxId)) throw new ClientAccessError("INVALID_ORGANIZATION_CNPJ");
    if (await this.gateway.getAccess(input.organizationId)) throw new ClientAccessError("CLIENT_ACCESS_ALREADY_EXISTS");

    const technicalEmail = buildTechnicalClientEmail(organization.taxId);
    let userId: string | null = null;
    try {
      userId = await this.gateway.createAuthUser({ email: technicalEmail, password: parsedPassword.data, fullName: organization.legalName, organizationId: organization.id });
      await this.gateway.registerAccess({ organization, userId, technicalEmail, actorUserId: input.actorUserId });
    } catch (error) {
      if (userId) await this.gateway.cleanupFailedRegistration(organization.id, userId);
      if (error instanceof ClientAccessError) throw error;
      throw new ClientAccessError(userId ? "CLIENT_ACCESS_PERSIST_FAILED" : "AUTH_USER_CREATION_FAILED");
    }
    return this.getSummary(input.organizationId);
  }

  async block(input: { organizationId: string; actorUserId: string }) {
    const access = await this.requireAccess(input.organizationId);
    try { await this.gateway.setAccessState({ ...input, userId: access.userId, enabled: false }); }
    catch { throw new ClientAccessError("CLIENT_ACCESS_UPDATE_FAILED"); }
    // Membership/RLS is disabled first, which blocks existing JWTs immediately.
    // The Auth ban then prevents new sessions as an additional boundary.
    await this.gateway.updateAuthUser(access.userId, { ban_duration: "876000h" });
    return this.getSummary(input.organizationId);
  }

  async reactivate(input: { organizationId: string; actorUserId: string }) {
    const access = await this.requireAccess(input.organizationId);
    await this.gateway.updateAuthUser(access.userId, { ban_duration: "none" });
    try { await this.gateway.setAccessState({ ...input, userId: access.userId, enabled: true }); }
    catch {
      await this.gateway.updateAuthUser(access.userId, { ban_duration: "876000h" }).catch(() => undefined);
      throw new ClientAccessError("CLIENT_ACCESS_UPDATE_FAILED");
    }
    return this.getSummary(input.organizationId);
  }

  async resetPassword(input: { organizationId: string; actorUserId: string; password: string }) {
    const parsedPassword = passwordSchema.safeParse(input.password);
    if (!parsedPassword.success) throw new ClientAccessError("PASSWORD_INVALID");
    const access = await this.requireAccess(input.organizationId);
    await this.gateway.updateAuthUser(access.userId, { password: parsedPassword.data });
    await this.gateway.recordPasswordReset({ organizationId: input.organizationId, userId: access.userId, actorUserId: input.actorUserId });
    return this.getSummary(input.organizationId);
  }

  private async requireAccess(organizationId: string) {
    const access = await this.gateway.getAccess(organizationId);
    if (!access) throw new ClientAccessError("CLIENT_ACCESS_NOT_FOUND");
    return access;
  }
}

function required<T>(data: T | null, error: unknown): T {
  if (error || !data) throw error ?? new Error("SUPABASE_RESULT_REQUIRED");
  return data;
}

export function createSupabaseClientAccessGateway(admin: SupabaseClient = createAdminClient()): ClientAccessGateway {
  return {
    async getOrganization(id) {
      const { data, error } = await admin.from("organizations").select("id,legal_name,tax_id").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, legalName: data.legal_name, taxId: data.tax_id } : null;
    },
    async getAccess(organizationId) {
      const { data, error } = await admin.from("client_accesses").select("organization_id,user_id,technical_email,enabled,created_at,blocked_at").eq("organization_id", organizationId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [{ data: membership, error: membershipError }, { data: authData, error: authError }] = await Promise.all([
        admin.from("memberships").select("active,role").eq("organization_id", organizationId).eq("user_id", data.user_id).maybeSingle(),
        admin.auth.admin.getUserById(data.user_id),
      ]);
      if (membershipError) throw membershipError;
      const bannedUntil = authData.user?.banned_until ? new Date(authData.user.banned_until) : null;
      const authUserActive = !authError && Boolean(authData.user) && (!bannedUntil || bannedUntil <= new Date());
      return { organizationId: data.organization_id, userId: data.user_id, technicalEmail: data.technical_email, enabled: data.enabled, createdAt: data.created_at, blockedAt: data.blocked_at, membership, authUserActive };
    },
    async createAuthUser(input) {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
        app_metadata: { account_type: "CLIENT_USER", organization_id: input.organizationId },
      });
      return required(data.user, error).id;
    },
    async registerAccess(input) {
      const { error } = await admin.rpc("register_client_access", { p_organization_id: input.organization.id, p_user_id: input.userId, p_technical_email: input.technicalEmail, p_full_name: input.organization.legalName, p_actor_user_id: input.actorUserId });
      if (error) throw error;
    },
    async cleanupFailedRegistration(organizationId, userId) {
      await Promise.allSettled([
        admin.from("client_accesses").delete().eq("organization_id", organizationId).eq("user_id", userId),
        admin.from("memberships").delete().eq("organization_id", organizationId).eq("user_id", userId),
        admin.from("profiles").delete().eq("user_id", userId),
      ]);
      await admin.auth.admin.deleteUser(userId);
    },
    async updateAuthUser(userId, attributes) {
      const { error } = await admin.auth.admin.updateUserById(userId, attributes);
      if (error) throw error;
    },
    async setAccessState(input) {
      const { error } = await admin.rpc("set_client_access_state", { p_organization_id: input.organizationId, p_user_id: input.userId, p_enabled: input.enabled, p_actor_user_id: input.actorUserId });
      if (error) throw error;
    },
    async recordPasswordReset(input) {
      const { error } = await admin.rpc("record_client_password_reset", { p_organization_id: input.organizationId, p_user_id: input.userId, p_actor_user_id: input.actorUserId });
      if (error) throw error;
    },
  };
}

export function createClientAccessService(admin?: SupabaseClient) {
  return new ClientAccessService(createSupabaseClientAccessGateway(admin));
}
