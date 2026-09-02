# The Problem

LinkScribe's original monolink processing pipeline was built almost entirely around Supabase. It was simple to operate at first, but as bookmark links became shared resources across users, the reliability requirements changed significantly.

The biggest issue was that Supabase Queues were pull-based. Jobs could sit in the queue, but an Edge Function was responsible for repeatedly waking up and consuming them. We had to build our own mechanism with `pg_net` to keep invoking the function until the queue was drained.

This created a fragile dependency on the consumer function staying alive. If it crashed during processing, there was no independent system responsible for starting it again. Work could remain stuck until another event caused a fresh invocation.

Concurrency was another problem. Processing large queues sequentially was too slow, but simply spawning more Edge Functions through `pg_net` could result in uncontrolled fan-out and unpredictable database load. Properly solving that would have required additional infrastructure to track and limit active workers.

The same problem existed further down the pipeline. The ingest scrape worker needed to fan processed links out into LLM enrichment, vector synchronization, security checks, screenshot generation, and other features. These operations were also triggered through `pg_net`, meaning each feature effectively needed its own retry, rescheduling, concurrency, and rate-limiting logic.

As more features were added, the architecture would become increasingly difficult to maintain.

Cron was considered as a way to recover abandoned work, but that introduced another form of waste. Every queue would need periodic polling even when there was nothing to process, resulting in large numbers of unnecessary function invocations.

Scraping itself also became a reliability concern. Processing raw HTML with Cheerio and converting it to markdown could cause significant memory usage, occasionally pushing workers beyond their runtime limits during periods of higher throughput.

The fundamental problem was therefore bigger than Supabase Queues themselves. We were gradually building our own queue-consumer system, retry mechanism, concurrency controller, scheduler, and fan-out infrastructure around database functions.

The pipeline worked, but too much of its reliability depended on application code and database-level orchestration rather than infrastructure designed specifically for asynchronous job processing.
