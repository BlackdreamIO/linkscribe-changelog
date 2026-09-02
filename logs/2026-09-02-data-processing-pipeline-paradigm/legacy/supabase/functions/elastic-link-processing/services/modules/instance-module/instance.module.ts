import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { BaseElasticLinkProcessingModule } from "../../base/BaseElasticLinkProcessing.module.ts";
import { IJob } from "../../../interfaces/IBase.ts";
import { WorkerRepository } from "./repository/worker.repository.ts";
import { MAX_CONCURRENT_WORKERS, MAX_INSTANCE_JITTER_MS } from "../../../instance.config.ts";

const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");

export class InstanceModule extends BaseElasticLinkProcessingModule {
    private repo : WorkerRepository;

    constructor(instanceId : string, jobs : IJob[]) {
        super(jobs);
        this.repo = new WorkerRepository(instanceId);
    }

    async acquireWorkerSlot() {
        return await this.repo.acquireWorkerSlot();
    }

    async releaseWorkerSlot() {
        return await this.repo.releaseWorkerSlot();
    }

    async getSlotCount() {
        return await this.repo.slotCount();
    }

    async jitter() {
        const jitter = Math.floor(Math.random() * MAX_INSTANCE_JITTER_MS);
        await new Promise(res => setTimeout(res, jitter));
    }

    async selfSchedule(remainingJobs : number) {
        try {
            this.log("info", "🔁 Remaining jobs found, invoking self", { remainingJobs });

            const activeWorkers = await this.getSlotCount();

            if(activeWorkers >= MAX_CONCURRENT_WORKERS) {
                this.log("info", "⚠️ Max workers already active, skipping self-invocation", { activeWorkers, maxWorkers: MAX_CONCURRENT_WORKERS });
                return;
            }

            const spotsAvailable = MAX_CONCURRENT_WORKERS - activeWorkers;
            const batchesNeeded = Math.ceil(remainingJobs / 10);
            const workersToSpawn = Math.min(spotsAvailable, batchesNeeded);

            if (workersToSpawn <= 0) return;

            const upstashUrl = "https://qstash.upstash.io/v2/batch"
            const functionUrl = "https://vxgloreihzgwrzogdaoe.supabase.co/functions/v1/elastic-link-processing";

            const batchRequests : {destination : string, headers : Record<string, string>, body : string}[] = [];

            for (let i = 0; i < workersToSpawn; i++) {
                //await this.cache.incr(WORKER_COUNT_KEY);
                //await this.cache.expire(WORKER_COUNT_KEY, WORKER_SLOT_ACQUIRE_TTL);
                
                batchRequests.push({
                    destination: functionUrl,
                    headers: { "Upstash-Delay": "5s" },
                    body: JSON.stringify({ task: `run-${i + 1}` })
                })
            }

            const res = await fetch(upstashUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${QSTASH_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body : JSON.stringify(batchRequests),
            })

            const data = await res.json();

            this.log("info", "✅ Successfully invoked self", {
                messageId: data?.messageId,
                workersToSpawn: workersToSpawn,
                remainingJobs,
                activeWorkers,
                spotsAvailable,
            });
        }
        catch (error) {
            Sentry.captureException(error, {
                extra: {
                    source: "selfSchedule",
                    type: "Unexpected Runtime Crash",
                },
                tags: {
                    error_source: "runtime",
                    function: "selfSchedule",
                    category: "elastic_link_processing",
                    is_fatal: "true",
                }
            });
        }
    }
}