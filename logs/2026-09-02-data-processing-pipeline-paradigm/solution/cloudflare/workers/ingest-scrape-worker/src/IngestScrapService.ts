import * as Sentry from "@sentry/cloudflare";
import { SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getRedis } from "./utils/redis";
import { getSupabase } from "./utils/supabase";
import { IJob, ILink } from "./types/Job.types";
import { DatabaseService } from "./modules/database-service";
import { CacheService } from "./modules/cache-service";
import { FailedLink, IExtendedScrapLink, ScrapService } from "./modules/scrap-service";
import { TinyFish } from "@tiny-fish/sdk";
import { getTinyFish } from "./utils/tinyfish";
import { LoggerService } from "./modules/logger-service";
import { Logger } from "./utils/logger";

interface IngestionDependencies {
    onRateLimitExceeded: (retryAfterSeconds : number, deferredMsgIds : string[]) => void;
    onFaildScrapLinks: (jobs : string[]) => void;
    onComplete: (jobs : IExtendedScrapLink[]) => Promise<void>;
}

export class IngestScrapService extends LoggerService { 
    private redis : Redis;
    private supabase : SupabaseClient;
    private tinyFish : TinyFish;
    private jobs : IJob[] = [];

    private readonly databaseService : DatabaseService;
    private readonly cacheService : CacheService;
    private readonly scrapService : ScrapService;

    constructor (protected batch : MessageBatch<ILink>, protected env : Env, logger : Logger) {
        super(logger);

        this.redis = getRedis();
        this.supabase = getSupabase();
        this.tinyFish = getTinyFish();

        this.jobs = batch.messages.map(job => ({ msg_id: job.id, ...job.body }));

        this.databaseService = new DatabaseService(this.supabase, this.logger);
        this.cacheService = new CacheService(this.redis, this.logger);
        this.scrapService = new ScrapService(this.tinyFish, this.logger);
    }

    public async startIngestionProcess({ onFaildScrapLinks, onRateLimitExceeded, onComplete } : IngestionDependencies) {
        return Sentry.startSpan({ name: "ingest_scrape.start", op: "task", attributes: { job_count: this.jobs.length } }, async (span) => {
            
            this.logger.info(`Ingestion batch process started with ${this.jobs.length} jobs`, {jobs: this.jobs, totalJobs: this.jobs.length, batchId: this.batch.messages[0]?.id});
            
            const batchSize = this.jobs.length;
            const { exceeded, remaining, resetAt } = await this.cacheService.consumeToken(batchSize);

            let jobsToProcess = this.jobs;
            let deferredJobs: typeof this.jobs = [];
            
            if (exceeded) {
                return Sentry.startSpan({ name : "ingest_scrape.rateLimitExceeded", op : "task", attributes : { deferred_count: this.jobs.length } }, async () => {
                    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
                    console.warn(`Rate limit exceeded. Retry in ${retryAfterSeconds}s`);

                    if (remaining > 0) {
                        jobsToProcess = this.jobs.slice(0, remaining); // Take only the items from index 0 up to `remaining`
                        deferredJobs = this.jobs.slice(remaining); // Take the rest of the items from `remaining` to the end
                    }
                    else {
                        jobsToProcess = [];
                        deferredJobs = this.jobs;
                    }

                    this.logger.warn("Rate limit threshold exceeded during ingestion", {
                        retryAfterSeconds,
                        resetAt,
                        exceeded,
                        remainingTokens: remaining,
                        totalJobs: this.jobs.length,
                        processingJobsCount: jobsToProcess.length,
                        deferredJobsCount: deferredJobs.length,
                        deferredJobIds: deferredJobs.map(j => j.msg_id)
                    });

                    onRateLimitExceeded(retryAfterSeconds, deferredJobs.map(j => j.msg_id));
                    
                    if (jobsToProcess.length === 0) {
                        this.logger.info("Ingestion execution halted: All jobs deferred due to rate limit");
                        return;
                    }
                })
            }

            const { scrapedLinks, scrapedFailed } = await this.scrapService.scrapLinks(jobsToProcess);
            const databaseUpdateFailedLinks = await this.databaseService.updateSharedLinksPaylod(scrapedLinks);
            await this.updateFailedScrapStatus(scrapedFailed);

            const failedLinks = [...databaseUpdateFailedLinks, ...scrapedFailed];
            
            if (failedLinks.length > 0) {
                this.logger.warn("Ingestion completed with partial link failures", {
                    totalAttempted: jobsToProcess.length,
                    successfulCount: scrapedLinks.length,
                    failedCount: failedLinks.length,
                    failedLinks,
                    remainingToken : remaining
                });
            }
            else {
                this.logger.info("✅ Ingestion batch processing completed successfully", {
                    processedCount: scrapedLinks.length,
                    remainingToken : remaining
                });
            }

            onFaildScrapLinks(failedLinks.map(job => job.msg_id));
            onComplete(scrapedLinks);
        })
    }

    private async updateFailedScrapStatus(failedLinks : FailedLink[]) {
        const updatePromises = failedLinks.map(({ reason, url_hash }) => this.databaseService.updateSharedLinkStatus({ status: "FAILED", url_hash, error: reason }));
        await Promise.allSettled(updatePromises);
    }

    public async enqueueJobs(jobs : IExtendedScrapLink[]) {
        if (!jobs || jobs.length === 0) {
            this.logger.info("Skipped enqueuing jobs: Job list is empty");
            return;
        }

        return Sentry.startSpan({ name : "ingest_scrape.addScrapedLinksToFeatureQueues", op: "db", attributes : { jobCount : jobs.length } }, async () => {
            this.logger.info("Enqueuing scraped links to downstream feature queues", {
                jobCount: jobs.length,
                jobIds: jobs.map(j => j.id ?? j.msg_id)
            });
            
            const preparedMessages : MessageSendRequest[] = jobs.map(job => ({
                body : job,
                contentType : "json",
                delaySeconds : 0
            }))

            //await this.env.MONO_LINK_LLM_ENRICHMENT_QUEUE.sendBatch(preparedMessages);
            //await this.env.MONO_LINK_NSFW_FILTER_QUEUE.sendBatch(preparedMessages);
            //await this.env.MONO_LINK_SCREENSHOT_QUEUE.sendBatch(preparedMessages);
            //await this.env.MONO_LINK_VECTOR_SYNC_QUEUE.sendBatch(preparedMessages);

            this.logger.info("✅ Successfully published job batch to all feature queues", {
                queueCount: 4,
                messagesPerQueue: preparedMessages.length,
                totalDispatched: preparedMessages.length * 4
            });
        })
    }
}