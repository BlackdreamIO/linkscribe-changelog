import { Redis } from "@upstash/redis/cloudflare";
import { env } from "cloudflare:workers";

let redis : Redis;

export const getRedis = () => {
    if(!redis) {
        redis = Redis.fromEnv(env);
    }
    return redis;
}
