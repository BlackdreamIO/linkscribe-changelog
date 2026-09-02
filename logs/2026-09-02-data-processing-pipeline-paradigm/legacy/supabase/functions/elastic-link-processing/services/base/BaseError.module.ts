import { PostgrestSingleResponse } from "npm:@supabase/postgrest-js@1.21.4";
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

type PostgrestResponse = PostgrestSingleResponse<unknown>;

type ErrorMeta = {
    source: string;
    function: string;
    type: string;
    category?: string;
    error_source: "supabase" | "runtime" | "redis";
    is_fatal: "true" | "false";
    http_status?: string;
    full_response?: PostgrestResponse;
}

export class BaseErrorModule {

    private webhook : any;

    constructor (webhook : any) {
        this.webhook = webhook;
    }

    private capture(error: unknown, meta: ErrorMeta): boolean {
        // TODO: Capture exception in Sentry with extras and tags from meta
        return false;
    }

    public queues = {
        fetch : (response : PostgrestResponse) : boolean => {
            // TODO: Handle Supabase fetch error logging
            return false;
        },
        fetchUnexpectedCrash : (error : Error | unknown) : boolean => {
            // TODO: Handle unexpected fetch crash error logging
            return false;
        },
        remainingJobsCount :(response : PostgrestResponse) : boolean => {
            // TODO: Handle remaining jobs count error logging
            return false;
        },
        deleteUnexpectedCrash : (error : Error | unknown) : boolean => {
            // TODO: Handle unexpected delete crash error logging
            return false;
        },
        addJobsToSummarizationQueue : (response : PostgrestResponse) : boolean => {
            // TODO: Delegate error capture for summarization queue insertion
            return false;
        },
        addJobsToSummarizationQueueUnexpectedCrash : (error : Error | unknown) : boolean => {
            // TODO: Delegate error capture for summarization queue crash
            return false;
        }
    }

    public monoLinkStore = {
        fetch : (response : PostgrestResponse) : boolean => {
            // TODO: Handle monoLinkStore fetch error logging
            return false;
        },
        fetchUnexpectedCrash : (error : Error | unknown) : boolean => {
            // TODO: Handle monoLinkStore fetch crash error logging
            return false;
        }
    }

    public sessions = {
        initialize : (error : Error | unknown) : boolean => {
            // TODO: Handle session initialization Redis error logging
            return false;
        },
       
    }
}