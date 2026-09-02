import { MAX_CONCURRENT_WORKERS, WORKER_COUNT_KEY, WORKER_SLOT_ACQUIRE_TTL } from "../../../../instance.config.ts";
import { getRedis } from "../../../../utils/redis.ts";

const redis = getRedis();

export class WorkerRepository {
    private cache : typeof redis;
    private _instanceId : string;

    constructor(instanceId : string) {
        this.cache = redis;
        this._instanceId = instanceId;
    }

    /*
    async acquireWorkerSlot() : Promise<"ALREADY_TAKEN" | "ACQUIRED"> {
        const WORKER_COUNT_KEY = `process:elp:active_workers`;
        const result = await this.cache.sadd(WORKER_COUNT_KEY, this._instanceId);

        result === 1 ? await this.cache.expire(WORKER_COUNT_KEY, WORKER_SLOT_ACQUIRE_TTL) : null;

        return result === 1 ? "ACQUIRED" : "ALREADY_TAKEN";
    }

    async slotCount() : Promise<number> {
        const WORKER_COUNT_KEY = `process:elp:active_workers`;
        return await this.cache.scard(WORKER_COUNT_KEY);
    }

    async releaseWorkerSlot() : Promise<void> {
        const WORKER_COUNT_KEY = `process:elp:active_workers`;
        await this.cache.srem(WORKER_COUNT_KEY, this._instanceId);
    }
    */

    async acquireWorkerSlot() : Promise<"ACQUIRED" | "LIMIT_REACHED"> {
        const count = await this.slotCount();
        if (count >= MAX_CONCURRENT_WORKERS) {
            return "LIMIT_REACHED";
        }

        await this.cache.multi()
            .incr(WORKER_COUNT_KEY)
            .expire(WORKER_COUNT_KEY, WORKER_SLOT_ACQUIRE_TTL)
            .exec();

        return "ACQUIRED";
    }

    async slotCount() : Promise<number> {
        const result = await this.cache.get(WORKER_COUNT_KEY);
        return result ? parseInt(result) : 0;
    }

    async releaseWorkerSlot() {
        const count = await this.slotCount();
        if (count <= 0) {
            return await this.cache.set(WORKER_COUNT_KEY, 0);
        }
        return await this.cache.decr(WORKER_COUNT_KEY);
    }
}