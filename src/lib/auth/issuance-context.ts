export type IssuanceMembership = {
  organizationId: string;
  role: "SUPER_ADMIN" | "OFFICE_STAFF" | "CLIENT_USER";
};

export type IssuanceContext = {
  organizationId: string;
  actorUserId: string;
  actorType: "CLIENT" | "OFFICE";
  role: IssuanceMembership["role"];
};

export function resolveIssuanceContextFromMemberships(input: {
  actorUserId: string;
  memberships: IssuanceMembership[];
  requestedOrganizationId?: string;
}): IssuanceContext {
  const officeMemberships = input.memberships.filter(
    (item) => item.role === "SUPER_ADMIN" || item.role === "OFFICE_STAFF",
  );

  if (input.requestedOrganizationId) {
    const membership = officeMemberships.find((item) => item.organizationId === input.requestedOrganizationId);
    if (!membership) throw new Error("FORBIDDEN_OFFICE_ISSUANCE");
    return {
      organizationId: input.requestedOrganizationId,
      actorUserId: input.actorUserId,
      actorType: "OFFICE",
      role: membership.role,
    };
  }

  const clientMemberships = input.memberships.filter((item) => item.role === "CLIENT_USER");
  if (clientMemberships.length !== 1) throw new Error("ORGANIZATION_CONTEXT_REQUIRED");
  return {
    organizationId: clientMemberships[0].organizationId,
    actorUserId: input.actorUserId,
    actorType: "CLIENT",
    role: "CLIENT_USER",
  };
}
