import { AsyncLocalStorage } from "node:async_hooks";

// Global storage to track execution context across async calls without passing it down manually
const executionContextStorage = new AsyncLocalStorage<ExecutionContext>();

export function createLogger(env: Env, ctx?: ExecutionContext) {
    const activeCtx = ctx ?? executionContextStorage.getStore();

    const sendLog = (level: string, message: string, data: Record<string, unknown> = {}) => {
        const payload = {
            dt: new Date().toISOString(),
            level,
            message,
            data : data,
            runtime: "supabase-edge-function",
            path: "enrichment-link-processing",
        }

        const endpoint = env.LOGTAIL_INGEST_HOST ? `https://${env.LOGTAIL_INGEST_HOST}` : "https://in.logs.betterstack.com";

        const fetchPromise = fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.LOGTAIL_SOURCE_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }).catch((err) => console.error("BetterStack Logging Failed:", err));

        // If context exists, use waitUntil to keep worker alive; otherwise fire-and-forget
        if (activeCtx?.waitUntil) {
            activeCtx.waitUntil(fetchPromise);
        }
    }

    const logger = {
        log: (message: string, data?: Record<string, unknown>) => sendLog("info", message, data),
        info: (message: string, data?: Record<string, unknown>) => sendLog("info", message, data),
        warn: (message: string, data?: Record<string, unknown>) => sendLog("warn", message, data),
        error: (message: string, data?: Record<string, unknown>) => sendLog("error", message, data),
        debug: (message: string, data?: Record<string, unknown>) => sendLog("debug", message, data),
        withExecutionContext: (newCtx: ExecutionContext) => createLogger(env, newCtx),
    }

    return logger;
}

export type Logger = ReturnType<typeof createLogger>;