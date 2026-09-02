import * as Sentry from "@sentry/cloudflare";
import { IngestScrapService } from "./IngestScrapService";
import { IJob } from "./types/Job.types";
import { createLogger } from "./utils/logger";

const worker : ExportedHandler<Env, IJob> = {
	async fetch(): Promise<Response> {
		return Response.json({ message : "Worker is running"}, { status: 200 });
	},
	async queue(batch: MessageBatch<IJob>, env : Env, ctx: ExecutionContext): Promise<void> {
		const logger = createLogger(env, ctx);

		return await Sentry.startSpan({ name: "ingest_scrape.queue", op: "task", attributes: { batch_size: batch.messages.length }}, async () => {
			try {
				const service = new IngestScrapService(batch, env, logger);

				await service.startIngestionProcess({
					onRateLimitExceeded(retryAfterSeconds, msgIds) {
						batch.messages
							.filter(msg => msgIds.some(msgId => msg.id == msgId))
							.map(msg => msg.retry({ delaySeconds : retryAfterSeconds }));
					},
					onFaildScrapLinks(msgIds) {
						batch.messages.filter(msg => msgIds.some(msgId => msg.id == msgId)).map(msg => msg.ack());
					},
					async onComplete(jobs) {
						const msgIds = jobs.map(j => j.msg_id);
						batch.messages.filter(msg => msgIds.some(msgId => msg.id == msgId)).map(msg => msg.ack());
						await service.enqueueJobs(jobs);
					},
				})	
			}
			catch (err) {
				console.error("ingestion_runtime_error", { error: err });
				batch.retryAll(); 
				throw err;
			}
		})
	}
}

export default Sentry.withSentry(
  	(env : Env) => ({
		dsn: env.SENTRY_DSN,
		tracesSampleRate: 1.0,
  	}),
  	worker as ExportedHandler<Env>
)

Sentry.setTag("environment", "cloudflare");