import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { log } from "../lib/logger.ts";

const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");

export async function selfSchedule() {
    try {
        log("info", "ELASTIC-LINK-PROCESSING", { message : "🔁 Remaining jobs found, invoking self" });

        const upstashUrl = "https://qstash.upstash.io/v2/batch"
        const functionUrl = "https://vxgloreihzgwrzogdaoe.supabase.co/functions/v1/elastic-link-processing";

        const messages = [
            {
                destination: functionUrl,
                headers: { "Upstash-Delay": "5s" },
                body: JSON.stringify({ task: "run-1" })
            },
            {
                destination: functionUrl,
                headers: { "Upstash-Delay": "5s" },
                body: JSON.stringify({ task: "run-2" })
            },
            {
                destination: functionUrl,
                headers: { "Upstash-Delay": "5s" },
                body: JSON.stringify({ task: "run-3" })
            }
        ]

        const res = await fetch(upstashUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${QSTASH_TOKEN}`,
                "Content-Type": "application/json",
            },
            body : JSON.stringify(messages),
        })

        const data = await res.json();

        if(data.messageId) {
            log("info", "ELASTIC-LINK-PROCESSING", { message : "✅ Successfully invoked self" });
        }
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