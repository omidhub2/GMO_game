import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/db";

const SESSION_COOKIE = "gmo_session";

export async function getAuthenticatedUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await getPrisma().session.findUnique({
    where: { tokenHash },
    select: {
      userId: true, expiresAt: true, user: { select: { status: true } },
    },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  return session.userId;
}
