import { createClient, RESP_TYPES } from "redis";

type RedisClient = ReturnType<typeof createClient>;

type GlobalRedisState = {
  redisClient?: RedisClient;
  connectPromise?: Promise<void>;
};

const globalForRedis = globalThis as unknown as GlobalRedisState;

function getOrCreateRedisClient() {
  if (globalForRedis.redisClient) return globalForRedis.redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Missing REDIS_URL environment variable.");
  }

  const client = createClient({ url });
  client.on("error", (error) => {
    console.error("Redis Client Error", error);
  });

  globalForRedis.redisClient = client;
  return client;
}

export async function getRedis() {
  const client = getOrCreateRedisClient();

  if (!client.isReady) {
    if (!globalForRedis.connectPromise) {
      globalForRedis.connectPromise = client
        .connect()
        .then(() => undefined)
        .finally(() => {
          globalForRedis.connectPromise = undefined;
        });
    }

    await globalForRedis.connectPromise;
  }

  return client;
}

export async function setBinary(key: string, bytes: Uint8Array, ttlSeconds?: number) {
  const client = await getRedis();
  const value = Buffer.from(bytes);
  if (ttlSeconds && ttlSeconds > 0) {
    await client.set(key, value, { EX: Math.floor(ttlSeconds) });
  } else {
    await client.set(key, value);
  }
}

export async function getBinary(key: string): Promise<Uint8Array | null> {
  const client = await getRedis();
  const binaryClient = client.withTypeMapping({
    [RESP_TYPES.BLOB_STRING]: Buffer,
  });

  const value = await binaryClient.get(key);
  return value ? new Uint8Array(value) : null;
}
