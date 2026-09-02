import { BaseElasticLinkProcessingModule } from "../base/BaseElasticLinkProcessing.module.ts";
import { IJob } from "../../interfaces/IBase.ts";
import { log } from "../../lib/logger.ts";
import { PostgrestSingleResponse } from "jsr:@supabase/supabase-js@2";
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { IScrapedData } from "./mono-link-store/getScrapedSharedLinks.ts";

export class QueuesModule extends BaseElasticLinkProcessingModule {
    constructor(jobs : IJob[]) {
        super(jobs);
    }

    public async getJobs() : Promise<{ success : boolean, jobs : IJob[] }> {
        try {
            log("info", '⏺️ Retriving Jobs..');

            const response = await this.db.schema("pgmq_public").rpc(`read`, {
                queue_name: "elastic-link-processing-queue",
                sleep_seconds : 30,
                n : 10
            });

            if(response.error || response.status !== 200) {
                log("error", "❌ Error Retriving Jobs", { error : response });
                this.errors.queues.fetch(response);
                return { jobs : [], success : false };
            }

            if(!response.data || response.data.length === 0) return { jobs : [], success : true };

            log("info", `⏺️ Retrived ${response.data.length} Jobs`, { jobs : response.data });

            return { jobs : response.data as IJob[], success : true };
        }
        catch (error) {
            this.errors.queues.fetchUnexpectedCrash(error);
            return { jobs : [], success : false };
        }
    }

    public async delete (jobIds : number[]) {
        log('info', `⏺️ Deleting (${jobIds.length}) Jobs`, { jobIds })

        await Promise.allSettled(jobIds.map(async (id) => {
            try {
                return await this.db.schema("pgmq_public").rpc('delete', { 
                    queue_name: "elastic-link-processing-queue", 
                    message_id: id
                })    
            }
            catch (error) {
                this.errors.queues.deleteUnexpectedCrash(error);
                throw error;
            }
        }));

        log('info', `⏺️ Deleted (${jobIds.length}) Jobs`, { jobIds })
    }

    public async addJobsToSummarizationQueue(sharedLinks : IScrapedData[]) {
        try {
            this.log("info", `⏺️ Adding ${sharedLinks.length} Jobs to Summarization Queue`)

            const structuredLinks = sharedLinks.map(m => {
                return {
                    scraped_link : {
                        url : m.url,
                        title : m.title,
                        description : m.description ?? '',
                    },
                    id : m.id,
                    url_hash : m.url_hash,
                    url : m.url,
                    queued_at : new Date().toISOString(),
                }
            }).filter(m => m.scraped_link.description?.length > 5)

            const chunkSize = 10;
            const chunks = [];

            for (let i = 0; i < structuredLinks.length; i += chunkSize) {
                chunks.push(structuredLinks.slice(i, i + chunkSize));
            }

            const chunksResponses: PostgrestSingleResponse<unknown>[] = [];

            const processes = chunks.map(async chunk => {
                const messagesBatch = chunk.map((c) => ({
                    scraped_link: c.scraped_link,
                    id: c.id,
                    url_hash: c.url_hash,
                    url: c.url,
                    queued_at: c.queued_at,
                    batch_queued_at: new Date().toISOString()
                }))

                const queueResponse = await this.db.schema("pgmq_public").rpc("send_batch", {
                    queue_name: "mono-links-summarization-queue",
                    messages: messagesBatch,
                    sleep_seconds: 0
                })

                chunksResponses.push(queueResponse);
            })

            await Promise.allSettled(processes);

            this.log('info', `⏺️ Added ${structuredLinks.length} Jobs to Summarization Queue`, { chunksResponses })

            for (const chunkResponse of chunksResponses) {
                if(chunkResponse.error) {
                    this.errors.queues.addJobsToSummarizationQueue(chunkResponse);
                }
            }

            const response = await this.db.rpc("invoke_edge_function_delayed", {
                target_url: "https://vxgloreihzgwrzogdaoe.supabase.co/functions/v1/enrichment-link-processing",
                request_headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SECRET_KEYS")}`
                },
                request_body: null,
                delay_seconds: 1
            })

            if (response.status !== 204) {
                await log("error", `Future Schedule Processing Failed ❌`);

                Sentry.captureException(response.error, {
                    extra : {
                        function : "handleFutureSchedule",
                        type : "database_error",
                        details : response
                    },
                    tags : {
                        function : "handleFutureSchedule",
                    }
                });
            }

            await log("info", "Self Scheduled ✅", {
                nextRun : new Date(Date.now() + 60 * 1000),
                localTimeString : new Date(Date.now() + 60 * 1000).toLocaleDateString('en-GB', {
                    day: 'numeric', 
                    month: 'long', 
                    hour: 'numeric', 
                    minute: 'numeric' 
                })
            });
        }
        catch (error) {
            this.errors.queues.addJobsToSummarizationQueueUnexpectedCrash(error);
        }
    }

    public async clear () {
        const msgIds = this.jobs.map((item) => item.msg_id);
        await this.delete(msgIds);
        log('info', `⏺✅ Cleared All Jobs`, { jobIds : msgIds })
    }

    public async hasJobs() : Promise<boolean> {
        const { data: hasRows, error } = await this.db
            .schema("elastic_link_processing_schema")
            .rpc('has_remaining_jobs_in_queue', { 
                t_schema: 'pgmq', 
                t_name: 'q_elastic-link-processing-queue' 
            });

        if (error) {
            this.errors.queues.fetchUnexpectedCrash(error);
            return false
        }

        return (hasRows ?? false) as boolean;
    }

    public async remainingJobsCount() : Promise<number> {
        const response  = await this.db
            .schema("public")
            .rpc('get_queue_size', { 
                q_name: "elastic-link-processing-queue" 
            });

        if (response.error) {
            this.errors.queues.remainingJobsCount(response);
            return 0
        }

        return (response.data ?? 0) as number;
    }
}