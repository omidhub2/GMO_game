import { NextResponse } from "next/server";
import { z } from "zod";
import { createRoom, joinRoom, readyRoom, roomAction, roomMessage, roomSnapshot, RoomError } from "@/modules/games/server/backgammon-rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const revision = z.number().int().nonnegative();
const source = z.union([z.literal("bar"), z.number().int().min(0).max(23)]);
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll"), revision, dice: z.tuple([z.number(), z.number()]) }),
  z.object({ type: z.literal("select"), revision, from: source.nullable() }),
  z.object({ type: z.literal("move"), revision, move: z.object({ from: source, to: z.union([z.literal("off"), z.number().int().min(0).max(23)]), die: z.number().int().min(1).max(6), hit: z.boolean() }) }),
  ...(["undo", "offerDouble", "acceptDouble", "rejectDouble", "nextGame"] as const).map(type => z.object({ type: z.literal(type), revision })),
]);
function failure(error: unknown) {
  if (error instanceof RoomError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "درخواست معتبر نیست." }, { status: 400 });
  return NextResponse.json({ error: "ارتباط با اتاق برقرار نشد." }, { status: 500 });
}
export async function GET(request: Request) {
  try {
    const room = z.string().uuid().parse(new URL(request.url).searchParams.get("room"));
    return NextResponse.json(roomSnapshot(room, request.headers.get("authorization")?.replace(/^Bearer /, "") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) throw new RoomError("مبدأ درخواست معتبر نیست.", 403);
    const body = await request.json();
    if (body.operation === "create") {
      const { color, target } = z.object({ color: z.enum(["light", "dark"]), target: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7), z.literal(9), z.literal(11)]).nullable() }).parse(body);
      return NextResponse.json(createRoom(color, target));
    }
    const room = z.string().uuid().parse(body.room);
    if (body.operation === "join") return NextResponse.json(joinRoom(room));
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (body.operation === "ready") return NextResponse.json(readyRoom(room, token));
    if (body.operation === "message") { const text = z.string().trim().min(1).max(120).parse(body.text); return NextResponse.json(roomMessage(room, token, text)); }
    if (body.operation === "action") return NextResponse.json(roomAction(room, token, actionSchema.parse(body.action)));
    throw new RoomError("درخواست معتبر نیست.");
  } catch (error) { return failure(error); }
}
