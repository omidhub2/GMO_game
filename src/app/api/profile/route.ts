import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return NextResponse.json({ error: "Open GMO Arena in Telegram to sign in." }, { status: 401 });
    const prisma = getPrisma();
    const [user, tournaments, wins, referrals] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: {
        username: true, createdAt: true, avatarUrl: true,
        profile: { select: { displayName: true, bio: true, avatarChoice: true, playerLevel: true, experience: true, preferredLocale: true } },
        externalAccounts: { where: { provider: "TELEGRAM" }, select: { providerUserId: true, metadata: true, connectedAt: true } },
      } }),
      prisma.tournamentParticipant.count({ where: { userId, status: { in: ["REGISTERED", "CONFIRMED"] }, tournament: { status: "COMPLETED" } } }),
      prisma.tournamentParticipant.count({ where: { userId, status: { in: ["REGISTERED", "CONFIRMED"] }, finalPosition: 1, tournament: { status: "COMPLETED" } } }),
      prisma.referral.count({ where: { inviterId: userId } }),
    ]);
    if (!user) return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
    const telegram = user.externalAccounts[0];
    const metadata = telegram?.metadata && typeof telegram.metadata === "object" && !Array.isArray(telegram.metadata) ? telegram.metadata as Record<string, unknown> : {};
    return NextResponse.json({ data: {
      username: user.username, avatarUrl: user.avatarUrl, avatarChoice: user.profile?.avatarChoice ?? "avatar-3", displayName: user.profile?.displayName ?? "", bio: user.profile?.bio ?? "",
      level: user.profile?.playerLevel ?? 1, experience: user.profile?.experience ?? 0,
      language: "en", createdAt: user.createdAt.toISOString(),
      telegram: telegram ? { id: telegram.providerUserId, username: typeof metadata.username === "string" ? metadata.username : "", connectedAt: telegram.connectedAt.toISOString() } : null,
      stats: { tournaments, wins, referrals },
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Player profile is temporarily unavailable." }, { status: 503 }); }
}

const profileInput = z.object({ avatarChoice: z.enum(["avatar-1", "avatar-2", "avatar-3", "profile-photo"]).default("avatar-3"), username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/), displayName: z.string().trim().max(64), bio: z.string().trim().max(500) });

export async function PATCH(request: Request) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return NextResponse.json({ error: "Open GMO Arena in Telegram to sign in." }, { status: 401 });
    const parsed = profileInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Check your player tag, display name, and bio." }, { status: 400 });
    const { username, displayName, bio, avatarChoice } = parsed.data;
    const updated = await getPrisma().$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { username }, select: { id: true } });
      if (existing && existing.id !== userId) throw new Error("USERNAME_TAKEN");
      return tx.user.update({ where: { id: userId }, data: { username, profile: { upsert: { create: { displayName, bio, avatarChoice, preferredLocale: "en" }, update: { displayName, bio, avatarChoice } } } }, select: { username: true } });
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "USERNAME_TAKEN") return NextResponse.json({ error: "That player tag is already taken." }, { status: 409 });
    return NextResponse.json({ error: "Profile changes could not be saved." }, { status: 503 });
  }
}
