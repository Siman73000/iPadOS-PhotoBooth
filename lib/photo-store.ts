import { randomUUID } from "node:crypto";
import { getRedis, getBinaryBase64, setBinary } from "./redis";

const CHUNK_SIZE = 2_000_000;

export type PhotoMetadata = {
  id: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  createdAt: string;
  chunks: number;
  kind: "single" | "strip";
};

function ttlSeconds() {
  const value = Number(process.env.PHOTO_TTL_SECONDS ?? "");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

export async function savePhoto(bytes: Uint8Array, metadata: Omit<PhotoMetadata, "id" | "createdAt" | "chunks">) {
  const id = randomUUID();
  const chunks = Math.ceil(bytes.byteLength / CHUNK_SIZE);
  const ttl = ttlSeconds();

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = bytes.slice(start, Math.min(start + CHUNK_SIZE, bytes.byteLength));
    await setBinary(`photo:${id}:chunk:${i}`, chunk, ttl);
  }

  const record: PhotoMetadata = {
    ...metadata,
    id,
    createdAt: new Date().toISOString(),
    chunks,
  };

  const redis = getRedis();
  if (ttl) await redis.set(`photo:${id}:meta`, record, { ex: ttl });
  else await redis.set(`photo:${id}:meta`, record);
  return record;
}

export async function getPhoto(id: string) {
  const redis = getRedis();
  const meta = await redis.get<PhotoMetadata>(`photo:${id}:meta`);
  if (!meta || !Number.isInteger(meta.chunks) || meta.chunks < 1) return null;

  const parts: Uint8Array[] = [];
  for (let i = 0; i < meta.chunks; i++) {
    const part = await getBinaryBase64(`photo:${id}:chunk:${i}`);
    if (!part) return null;
    parts.push(part);
  }

  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }

  return { meta, bytes: output };
}
