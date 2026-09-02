# The Solution

We rebuilt the monolink processing pipeline around Cloudflare Queues and Cloudflare Workers, moving job lifecycle management away from database functions and into infrastructure designed for asynchronous processing.

The database now acts as the source of truth for incoming work. When a new shared bookmark is inserted, a database webhook triggers an Edge Function, which bulk-dispatches the required jobs to the Cloudflare ingest scrape queue through the Cloudflare API.

The ingest scrape worker consumes those jobs and performs the initial scraping stage. Once scraping succeeds, the resulting data is distributed into dedicated downstream queues for LLM enrichment, vector synchronization, security checks, screenshot generation, and other processing stages.

Each feature now has an independent worker and queue. A worker processes a message and acknowledges it only after successful completion. If processing fails, the queue can retry the message automatically, and repeatedly failing jobs can eventually be moved to a dead letter queue.

This removes the need for every feature to implement its own rescheduling mechanism. Workers no longer need to recursively invoke themselves, and a crashed worker does not depend on a future producer event to start processing again.

The architecture also gives us a cleaner concurrency boundary. Instead of controlling a tree of Edge Function invocations through `pg_net`, concurrency can be managed at the queue and worker level without placing unpredictable recursive load on the database.

We also moved scraping out of the worker itself. Rather than fetching and parsing potentially large HTML documents with Cheerio, LinkScribe now uses Tinyfish as a managed scraping layer. This removes the memory-heavy parsing workload from our workers while giving us clean markdown output and handling scraping-specific concerns externally.

Cloudflare Workflows was considered as a higher-level orchestration layer, but the queue-and-worker model was ultimately preferred because the pipeline naturally consists of independent asynchronous processing stages.

The new architecture is not without tradeoffs. Cloudflare's queue operation limits introduce a new capacity constraint, so Redis-based rate tracking and a database staging queue are planned as a fallback when the daily operation threshold is approached.

Overall, the migration changes the responsibility model of the pipeline. Instead of LinkScribe continuously managing whether functions should wake up, retry, reschedule, and coordinate with one another, the queue infrastructure handles the job lifecycle while individual workers focus on one processing task at a time.
