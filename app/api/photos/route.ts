import { NextResponse } from "next/server";
import { savePhoto } from "@/lib/photo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = Number(process.env.MAX_PHOTO_BYTES ?? "4200000");

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/jpeg")) {
      return NextResponse.json({ error: "Only JPEG images are accepted." }, { status: 415 });
    }

    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BYTES) {
      return NextResponse.json({ error: "Photo is too large. Please retake the photo." }, { status: 413 });
    }

    const body = new Uint8Array(await request.arrayBuffer());
    if (!body.byteLength || body.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Invalid or oversized photo." }, { status: 413 });
    }

    const header = request.headers.get("x-photo-metadata");
    if (!header) return NextResponse.json({ error: "Missing photo metadata." }, { status: 400 });

    let incoming: { width: number; height: number; kind: "single" | "strip" };
    try {
      incoming = JSON.parse(header);
    } catch {
      return NextResponse.json({ error: "Invalid photo metadata." }, { status: 400 });
    }

    if (!Number.isFinite(incoming.width) || !Number.isFinite(incoming.height) || !["single", "strip"].includes(incoming.kind)) {
      return NextResponse.json({ error: "Invalid photo metadata." }, { status: 400 });
    }

    const photo = await savePhoto(body, {
      contentType: "image/jpeg",
      size: body.byteLength,
      width: Math.round(incoming.width),
      height: Math.round(incoming.height),
      kind: incoming.kind,
    });

    return NextResponse.json({
      id: photo.id,
      downloadUrl: `/api/photos/${photo.id}`,
      createdAt: photo.createdAt,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
  }
}
