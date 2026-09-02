import { describe, it, expect } from "vitest";
import { CacheService } from "../src/modules/cache-service";
import { MockRedis } from "./utils/test-helpers";

describe("CacheService", () => {
    it("consumeToken returns not exceeded when under limit", async () => {
        const redis = new MockRedis() as any;
        const cache = new CacheService(redis);

        const result = await cache.consumeToken(10);

        expect(result.exceeded).toBe(false);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
        expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it("consumeToken marks exceeded when over maxTokens", async () => {
        const redis = new MockRedis() as any;
        const cache = new CacheService(redis);

        // First call: use 140
        const r1 = await cache.consumeToken(140);
        expect(r1.exceeded).toBe(false);

        // Second call: push over 150
        const r2 = await cache.consumeToken(20);
        expect(r2.exceeded).toBe(true);
        expect(r2.remaining).toBe(0);
    });
});