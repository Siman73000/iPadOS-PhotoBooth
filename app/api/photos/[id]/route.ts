import { NextResponse } from "next/server";
import { getPhoto } from "@/lib/photo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[a-f0-9-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

    const photo = await getPhoto(id);
    if (!photo) return new NextResponse("Photo not found", { status: 404 });

    return new NextResponse(Buffer.from(photo.bytes), {
      status: 200,
      headers: {
        "Content-Type": photo.meta.contentType,
        "Content-Length": String(photo.bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="wedding-photo-${photo.meta.id}.jpg"`,
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Unable to load photo", { status: 500 });
  }
}
