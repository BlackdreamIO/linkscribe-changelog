import * as Sentry from "@sentry/cloudflare";
import { SupabaseClient } from "@supabase/supabase-js";
import { FailedLink, IExtendedScrapLink } from "./scrap-service";
import { Logger } from "../utils/logger";
import { LoggerService } from "./logger-service";


type SharedLinkStatusUpdate = {
    url_hash : string;
    status : "SUCCESS" | "FAILED" | "PENDING",
    error? : unknown;
}

export class DatabaseService extends LoggerService {

    constructor (protected readonly db : SupabaseClient, logger : Logger) {
        super(logger);
    }

    public async updateSharedLinksPaylod(scrapedLinks : IExtendedScrapLink[]) {
        return Sentry.startSpan({ name : "ingest_scrape.updateSharedLinkPayload", op: "db", attributes : { jobCount : scrapedLinks.length } }, async (span) => {
            this.logger.info("Starting database update for scraped links payload", {
                linkCount: scrapedLinks.length,
                linkIds: scrapedLinks.map(l => l.id)
            });
            
            const failedLinks : FailedLink[] = [];
            let successCount = 0;

            for(const { url, title, description, id, author, url_hash, msg_id } of scrapedLinks) {
                try {
                    const sharedLinkUpdateResponse = await this.db
                        .schema("mono_links_schema")
                        .from("shared_links")
                        .update({
                            scrap_data : { url, title, description, author },
                            updated_at : new Date().toISOString()
                        })
                        .eq("id", id);

                    if(sharedLinkUpdateResponse.error) {
                        this.logger.warn("Database error when updating shared link payload", {
                            id,
                            url,
                            url_hash,
                            error: sharedLinkUpdateResponse.error
                        });

                        Sentry.captureException(sharedLinkUpdateResponse.error, {
                            tags : {
                                function : "updateSharedLinksPaylod",
                                path : "helpers/db/database-service.ts",
                                producer : "catch exception",
                                details : JSON.stringify({ link : {id, url, url_hash, msg_id}, response : sharedLinkUpdateResponse })
                            }
                        })

                        failedLinks.push({ id, url_hash, msg_id, reason : "error during update", url });
                        await this.updateSharedLinkStatus({ url_hash, status : "FAILED", error : 'error during update' });
                        continue;
                    }

                    await this.updateSharedLinkStatus({ url_hash, status : "SUCCESS" });
                    successCount++;
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : "runtime exception";

                    this.logger.error("Runtime exception during database payload update", {
                        id,
                        url,
                        url_hash,
                        error: errorMsg
                    });

                    Sentry.captureException(error, {
                        tags : {
                            function : "updateSharedLinksPaylod",
                            path : "helpers/db/database-service.ts",
                            producer : "catch exception",
                            details : JSON.stringify({ id, url, url_hash, msg_id })
                        }
                    })
                    
                    failedLinks.push({ id, url_hash, msg_id, reason : "runtime exception", url });
                    await this.updateSharedLinkStatus({ url_hash, status : "FAILED", error : 'runtime exception' });
                    continue;
                }
            }
            
            span.setAttributes({
                successful_updates: successCount,
                failed_updates: failedLinks.length
            });

            if (failedLinks.length > 0) {
                this.logger.warn("Database shared link payload update finished with partial failures", {
                    totalAttempted: scrapedLinks.length,
                    successCount,
                    failedCount: failedLinks.length,
                    failedLinks
                });
            }
            else {
                this.logger.info("Database shared link payload update completed successfully for all items", {
                    updatedCount: successCount
                });
            }

            return failedLinks;
        })
    }

    public async updateSharedLinkStatus ({ status, url_hash, error } : SharedLinkStatusUpdate) {
        try {
            await this.db
                .schema("mono_links_schema")
                .rpc("update_shared_link_status", {
                    row_hash : url_hash,
                    stage_name : "scraping",
                    stage_status : status,
                    stage_error : error ?? "null",
                    current_stage_name : "INGEST_SCRAPE_WORKER"
                })        
        }
        catch (e) {
            console.log(`shared row failed to update status RPC call failed`, {
                url_hash,
                error,
                exception : e
            });
        }
    }
}