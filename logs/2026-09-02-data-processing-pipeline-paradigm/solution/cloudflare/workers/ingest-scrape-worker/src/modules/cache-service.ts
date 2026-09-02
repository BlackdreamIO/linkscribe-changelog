import { Redis } from "@upstash/redis";
import luaScript from "../lua/script.lua";
import { TINY_FISH_RATE_LIMIT } from "../config/tinfyFish.config";
import { LoggerService } from "./logger-service";
import { Logger } from "../utils/logger";

export interface IRateLimitResult {
    exceeded: boolean;
    remaining: number;
    resetAt: number;
}

export class CacheService extends LoggerService {
    protected readonly rateLimitKey = "process:rate-limits:tinyfish";
    protected readonly tpm = TINY_FISH_RATE_LIMIT["TPM"];
    protected readonly windowSeconds = TINY_FISH_RATE_LIMIT["WINDOW_SECONDS"];

    constructor (protected cache : Redis, logger : Logger) {
        super(logger);
    };

    public async consumeToken(cost: number = 1) : Promise<IRateLimitResult> {
        const now = Date.now();

        const [usage, ttl] = (await this.cache.eval(luaScript, [this.rateLimitKey], [cost, this.windowSeconds])) as [number, number];

        const resetAt = ttl > 0 ? now + ttl * 1000 : now + this.windowSeconds * 1000;
        const exceeded = usage > this.tpm;
        const remaining = Math.max(0, this.tpm - usage);

        return {
            exceeded,
            remaining,
            resetAt,
        }
    }
}