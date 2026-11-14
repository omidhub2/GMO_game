import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gmo_session")?.value;
  if (token) {
    try { await getPrisma().session.deleteMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } }); }
    catch { return NextResponse.json({ error: "Could not sign out. Please try again." }, { status: 503 }); }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set("gmo_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
