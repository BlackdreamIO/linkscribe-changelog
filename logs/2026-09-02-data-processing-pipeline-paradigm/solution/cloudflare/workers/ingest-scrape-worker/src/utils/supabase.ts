import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";

let supabase : SupabaseClient;

export const getSupabase = () => {
    if(!supabase) {
        supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY)
    }
    return supabase;
}