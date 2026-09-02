import * as Sentry from "@sentry/cloudflare";
import { TinyFish } from "@tiny-fish/sdk";
import { IJob } from "../types/Job.types";
import { LoggerService } from "./logger-service";
import { Logger } from "../utils/logger";

interface IScrapedLink {
    url: string;
    final_url: string | null;
    title: string | null;
    description: string | null;
    language: string | null;
    author: string | null;
    published_date: string | null;
    links?: string[];
    image_links?: string[];
    latency_ms?: number | null;
    not_modified?: boolean;
    etag?: string | null;
    last_modified?: string | null;
    format: "markdown" | "html" | "json";
}

export interface IExtendedScrapLink extends IScrapedLink {
    id : string;
    url_hash : string;
    msg_id : string;
}

export type FailedLink =  { id : string, url : string, msg_id : string, url_hash : string, reason : string }

export class ScrapService extends LoggerService {
    constructor (private readonly tinyfish: TinyFish, logger : Logger) {
        super(logger);
    }

    public async scrapLinks(jobs : IJob[]) : Promise<{ scrapedLinks : IExtendedScrapLink[], scrapedFailed : FailedLink[]}> {
        return Sentry.startSpan({ name : "ingest_scrape.scrapLinks", op: "task", attributes : { jobCount : jobs.length } }, async (span) => {
            this.logger.info("Starting link scraping process", {
                totalJobs: jobs.length,
                urls: jobs.map(j => j.url)
            });
            
            const jobMap = new Map<string, IExtendedScrapLink>();
            const failedScrapLinks : FailedLink[] = [];

            for (const job of jobs) {
                const result = await this.tinyfish.fetch.getContents({
                    format : "markdown",
                    urls : [job.url],
                });

                if(result.errors[0]?.error) {
                    const errorReason = result.errors[0].error;
                    this.logger.warn("Failed to scrape individual link", {
                        jobId: job.id,
                        url: job.url,
                        reason: errorReason
                    });
                    
                    failedScrapLinks.push({ ...job, reason : result.errors[0]?.error });
                    continue;
                }

                if(result.results[0]) jobMap.set(job.id, { ...result.results[0], ...job });
            }

            span.setAttributes({
                scraped : Array.from(jobMap.values()).length,
                failed : failedScrapLinks.length
            })

            return {
                scrapedLinks : Array.from(jobMap.values()),
                scrapedFailed : failedScrapLinks
            }
        })
    }
}