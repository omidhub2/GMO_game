import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUser();
    return NextResponse.json(
      { authenticated: Boolean(userId) },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch {
    return NextResponse.json(
      { authenticated: false, temporarilyUnavailable: true },
      { status: 503, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
