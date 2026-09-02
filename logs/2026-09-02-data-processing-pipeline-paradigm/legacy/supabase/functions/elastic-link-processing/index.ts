import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { ElasticLinkProcessingService } from "./services/ElasticLinkProcessing.ts";
import { log } from "./lib/logger.ts";

Sentry.init({
    dsn: Deno.env.get("SENTRY_DSN"),
    defaultIntegrations: false,
    tracesSampleRate: 1.0,
})

Deno.serve(async (req) => {
    const service = new ElasticLinkProcessingService();
    let hasSlot = false;

    try {        
        const executionId = Deno.env.get('SB_EXECUTION_ID');
        const requestId = req?.headers?.get("x-request-id");

        log("info", "ELASTIC-LINK-PROCESSING", { message : "-".repeat(50) });
        log("info", `ELASTIC-LINK-PROCESSING : EID(${executionId}) RQID(${requestId})`, { message : "Starting processing" });

        await service.instanceManager.jitter();
        
        // const status = await service.instanceManager.acquireWorkerSlot();

        // if (status === "LIMIT_REACHED") {
        //     log("info", "CONCURRENT_WORKERS_LIMIT_REACHED");
        //     return new Response(JSON.stringify({ success: true, message: "LIMIT" }));
        // }

        hasSlot = true;

        //const status = await elasticLinkProcessingService.instanceManager.acquireWorkerSlot();

        /*
        if(status === "ALREADY_TAKEN" || status === "CONCURRENT_WORKERS_LIMIT_REACHED")
            return new Response(JSON.stringify({ success: true, message: status }));
        */

        await service.initialize();
        await service.run();

        log("info", "ELASTIC-LINK-PROCESSING");

        return new Response(JSON.stringify({ success: true, message: "Successfully processed jobs" }));
    }
    catch (error) {
        Sentry.captureException(error, {
            extra: {
                source: "index",
                type: "Unexpected Runtime Crash",
            },
            tags: {
                error_source: "runtime",
                function: "index",
                category: "elastic_link_processing",
                is_fatal: "true",
            }
        });
        return new Response(
            JSON.stringify({ err : error, success: false }),
            { headers: { "Content-Type": "application/json" } },
        )
    }
    finally {
        if (hasSlot) {
            log("info", "⏺️ Releasing worker slot");
            await service.instanceManager.releaseWorkerSlot();
            log("info", "✅ Worker slot released");
        }
    }
})