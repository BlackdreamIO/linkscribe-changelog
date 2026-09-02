// deno-lint-ignore-file
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { getSupabase } from "../../../../utils/supabase.ts";
import { IScrapedData } from "../getScrapedSharedLinks.ts";

const supabase = getSupabase();

export async function syncDatabase(scrapedLinks : IScrapedData[]) {
    try {
        const processes = scrapedLinks.map(async ({ description, url_hash, title, url, og_img, error : scrapError, id, status : scrapStatus }) => {
            try {
                const { error, status, statusText } = await supabase
                    .schema("mono_links_schema")
                    .from("shared_links")
                    .update({
                        scrap_data: {
                            title : title ?? 'N/A',
                            description : description ?? 'N/A',
                            url : url ?? 'N/A',
                            og_img : og_img ?? 'N/A',
                        },
                        updated_at : new Date().toISOString()
                    })
                    .eq("url_hash", url_hash)

                if (error) {
                    const err = new Error(JSON.stringify({error, status, statusText}));
                    (err as any).id = id;
                    throw err;
                }

                try {
                    await supabase
                        .schema("mono_links_schema")
                        .rpc("update_shared_link_status", {
                            row_hash : url_hash,
                            stage_name : "scraping",
                            stage_status : scrapStatus,
                            stage_error : scrapError ?? "NOTHING",
                            current_stage_name : "ELASTIC_LINK_PROCESSING"
                        })    
                }
                catch (error) {
                    Sentry.captureException(error, {
                        extra : {
                            path : "SUPABASE-EDGE/ELASTIC-LINK-PROCESSING",
                            environment : "production",
                            type : "failed_mono_links_status_update",
                        }
                    })
                }

                return { id };
            }
            catch (error : any) {
                const err = new Error(error?.message);
                (err as any).id = id;
                throw err;
            }
        })

        const results = await Promise.allSettled(processes);

        const failedMonoLinks = results
            .filter((res): res is PromiseRejectedResult => res.status === "rejected")
            .map((res) => ({
                id: res.reason?.id || "unknown",
                error: res.reason?.message || "Unknown Supabase Error"
            }));

        if(failedMonoLinks.length > 0) {
            Sentry.captureException(new Error(`Failed to update (${failedMonoLinks.length}) MonoLinks in supabase`), {
                extra : {
                    path : "SUPABASE-EDGE/ELASTIC-LINK-PROCESSING",
                    environment : "production",
                    type : "failed_mono_links_update",
                    failedMonoLinks : failedMonoLinks.slice(0, 10)
                }
            })
        }
    }
    catch (_error) {
        console.log("Failed to update links in supabase");
        Sentry.captureException(_error, {
            extra : {
                path : "SUPABASE-EDGE/ELASTIC-LINK-PROCESSING",
                environment : "production",
                type : "failed_mono_links_update",
            }
        })
    }
}
