import { IJob } from "../interfaces/IBase.ts";
import { InstanceModule } from "./modules/instance-module/instance.module.ts";
import { getScrapedSharedLinks } from "./modules/mono-link-store/getScrapedSharedLinks.ts";

import { syncDatabase } from "./modules/mono-link-store/repository/syncDatabase.ts";
import { syncVectorDB } from "./modules/mono-link-store/repository/syncVectorDb.ts";
import { QueuesModule } from "./modules/queues.module.ts";

export class ElasticLinkProcessingService {

    private _initSuccess : boolean;
    private jobs : IJob[];
    private _instanceId : string;

    constructor() {
        this._instanceId = crypto.randomUUID();
        this._initSuccess = false;
        this.jobs = [];
        
        this.queuesManager = new QueuesModule(this.jobs);
        this.instanceManager = new InstanceModule(this._instanceId, this.jobs);
    }

    public readonly queuesManager : QueuesModule;
    public readonly instanceManager : InstanceModule;

    async initialize() {
        const jobsResult = await this.queuesManager.getJobs();
        if(!jobsResult.success) return false;

        this._initSuccess = true;

        this.jobs.length = 0;
        this.jobs.push(...jobsResult.jobs);
    }

    async run() {
        if(!this._initSuccess) return false;

        const scrapedLinks = await getScrapedSharedLinks(this.jobs);

        const failedLinksJobId = scrapedLinks.filter(l => l.status === "FAILED").map(f => f.msg_id);
        const processedScrapedLinks = scrapedLinks.filter(l => l.status === "SUCCESS");

        await Promise.allSettled([
            syncDatabase(scrapedLinks),
            syncVectorDB(processedScrapedLinks),
        ])

        await this.queuesManager.delete(failedLinksJobId);

        await this.queuesManager.addJobsToSummarizationQueue(processedScrapedLinks);

        await this.queuesManager.clear();

        const hasRemainingJobs = await this.queuesManager.hasJobs();
        if(hasRemainingJobs) {
            const remainingJobs = await this.queuesManager.remainingJobsCount();
            await this.instanceManager.selfSchedule(remainingJobs);
        }
    }
}