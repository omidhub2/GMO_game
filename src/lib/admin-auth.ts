import "server-only";

import { getPrisma } from "@/lib/db";

export async function hasAdminPermission(userId: string, permission: string) {
  const assignments = await getPrisma().adminUser.findMany({
    where: { userId },
    select: {
      role: { select: { permissions: true } },
    },
  });
  return assignments.some(({ role }) => {
    if (!Array.isArray(role.permissions)) return false;
    return role.permissions.some((value) => typeof value === "string" && (value === "*" || value === permission));
  });
}
