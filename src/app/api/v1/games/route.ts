import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { listDemoGames, toGameSummary } from "@/modules/games/domain/game";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  if (!process.env.DATABASE_URL) {
    const data = listDemoGames(query);
    return NextResponse.json({ data, meta: { demo: true, source: "demo" } }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  }

  try {
    const games = await getPrisma().game.findMany({
      where: {
        isEnabled: true,
        ...(query ? { OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { platforms: { has: query } },
        ] } : {}),
      },
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
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 100,
    });
    return NextResponse.json({ data: games.map(toGameSummary), meta: { demo: false, source: "database" } }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "The game catalog is temporarily unavailable." }, meta: { demo: false, source: "database" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
