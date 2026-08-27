export type MembershipRole = "SUPER_ADMIN"|"OFFICE_STAFF"|"CLIENT_USER";
const permissions={SUPER_ADMIN:["company:write","service:write","certificate:read","certificate:write","client-access:read","client-access:write","invoice:read","invoice:issue","audit:read"],OFFICE_STAFF:["service:write","certificate:read","client-access:read","invoice:read","audit:read"],CLIENT_USER:["invoice:read","invoice:issue","customer:write"]} as const;
export function can(role:MembershipRole,permission:string){return (permissions[role] as readonly string[]).includes(permission);}
export function assertOrganizationMembership(sessionOrganizationIds:string[],requestedOrganizationId:string){if(!sessionOrganizationIds.includes(requestedOrganizationId))throw new Error("FORBIDDEN_ORGANIZATION");}
