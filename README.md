# LinkScribe's Monolink Pipeline: From Supabase to Cloudflare

Where LinkScribe's shared-link processing architecture goes to get fixed. A breakdown of the problems we hit with Supabase queues, unreliable fan-out processing, concurrency, and polling, and why we rebuilt the pipeline around Cloudflare Queues and Workers.

This entry covers the migration from Supabase to Cloudflare, the move from self-managed scraping to Tinyfish, and the tradeoffs we discovered after rebuilding the system.