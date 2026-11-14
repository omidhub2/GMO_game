import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/object-storage";

export const runtime = "nodejs";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  // Authentication/ownership checks must be added before enabling this endpoint publicly.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "An authenticated upload flow is not configured." } }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("contentType" in body)) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "contentType is required." } }, { status: 400 });
  }
  const contentType = (body as { contentType?: unknown }).contentType;
  if (typeof contentType !== "string" || !allowedContentTypes.has(contentType.toLowerCase())) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Only JPEG, PNG, WebP, and AVIF images are allowed." } }, { status: 415 });
  }

  try {
    const key = `uploads/${randomUUID()}`;
    const url = await createUploadUrl({ key, contentType: contentType.toLowerCase(), expiresIn: 300 });
    return NextResponse.json({ data: { key, uploadUrl: url, expiresIn: 300, contentType: contentType.toLowerCase() } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "STORAGE_UNAVAILABLE", message: "Object storage is not configured or unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
