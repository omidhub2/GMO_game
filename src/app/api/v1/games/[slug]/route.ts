import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getDemoGame, toGameSummary } from "@/modules/games/domain/game";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (!process.env.DATABASE_URL) {
    const game = getDemoGame(slug);
    if (!game) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Game was not found." }, meta: { demo: true, source: "demo" } }, { status: 404 });
    return NextResponse.json({ data: game, meta: { demo: true, source: "demo" } }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  }

  try {
    const game = await getPrisma().game.findFirst({
      where: { slug, isEnabled: true },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        platforms: true,
        integrationType: true,
        _count: {
          select: {
            tournaments: {
              where: {
                status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "READY", "IN_PROGRESS"] },
                demoContent: false,
              },
            },
          },
        },
      },
    });
    if (!game) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Game was not found." }, meta: { demo: false, source: "database" } }, { status: 404 });
    return NextResponse.json({ data: toGameSummary(game), meta: { demo: false, source: "database" } }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "The game catalog is temporarily unavailable." }, meta: { demo: false, source: "database" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
