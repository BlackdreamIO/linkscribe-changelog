// deno-lint-ignore-file
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { emitVectorDbSyncEvent, IVectorEventPayload } from "../../../../helpers/emitVectorDbSync.ts";
import { IScrapedData } from "../getScrapedSharedLinks.ts";

export async function syncVectorDB(scrapedLinks : IScrapedData[]) {
    try {
        const structuredMonoLinks : IVectorEventPayload[] = scrapedLinks.map(({ title, content, description, url, url_hash, id }) => ({
            id,
            data : `
                User-Title: ${title}\n
                Website-Content: ${content || 'N/A'}\n
                Website-Description: ${description || 'N/A'}\n
            `,
            metadata : {
                id : id,
                title,
                description : description ?? 'N/A',
                url,
                url_hash
            },
        }))

        await emitVectorDbSyncEvent(structuredMonoLinks);

        return { failures : [] }
    }
    catch (error) {
        Sentry.captureException(error, {
            extra: { path: "SUPABASE-EDGE/ELASTIC-LINK-PROCESSING", type: "CRITICAL_UPSERT_HALT" }
        });

        return { failures : [] }
    }
}
