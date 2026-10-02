import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN.");
  }
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisBinaryCommand(path: string, init?: RequestInit, encoding = false) {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) throw new Error("Missing Upstash Redis environment variables.");

  const response = await fetch(`${url}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(encoding ? { "Upstash-Encoding": "base64" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Redis request failed (${response.status}): ${body}`);
  }
  return response;
}

export async function setBinary(key: string, bytes: Uint8Array, ttlSeconds?: number) {
  const suffix = ttlSeconds && ttlSeconds > 0 ? `?EX=${Math.floor(ttlSeconds)}` : "";
  await redisBinaryCommand(`set/${encodeURIComponent(key)}${suffix}`, {
    method: "POST",
    body: bytes as BodyInit,
    headers: { "Content-Type": "application/octet-stream" },
  });
}

export async function getBinaryBase64(key: string): Promise<Uint8Array | null> {
  const response = await redisBinaryCommand(`get/${encodeURIComponent(key)}`, { method: "GET" }, true);
  const payload = (await response.json()) as { result: string | null };
  if (!payload.result) return null;

  const base64 = payload.result;
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(base64, "base64"));

  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
