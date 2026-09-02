// deno-lint-ignore-file no-import-prefix
import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getSupabase } from "../../utils/supabase.ts";
import Redis from "npm:ioredis";
import { getRedis } from "../../utils/redis.ts";
import { BaseErrorModule } from "./BaseError.module.ts";
import { IJob } from "../../interfaces/IBase.ts";
import { log, Logger } from "../../lib/logger.ts";

export abstract class BaseElasticLinkProcessingModule {
    
    protected db: SupabaseClient;
    protected cache : Redis.Redis;
    protected errors : BaseErrorModule;
    protected log : Logger;

    constructor(protected jobs: IJob[]) {
        this.db = getSupabase();
        this.cache = getRedis();
        this.errors = new BaseErrorModule("KKSD");
        this.log = log;
    }
}