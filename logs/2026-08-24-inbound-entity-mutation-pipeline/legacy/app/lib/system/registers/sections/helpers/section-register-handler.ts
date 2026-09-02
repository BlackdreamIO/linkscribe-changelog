import { bulkDeleteMonoLinks, bulkUpdateMonoLinks } from "@/app/features/mono-links/slices/redux-mono-links-slice";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { equalsWithoutProperties } from "@/helpers/compareObjectWithExclusion";
import { ISection } from "@/interface/Section";
import { SubscriptionRepo } from "@/lib/database/dexie-primary/repos/SubscriptionRepo";
import { AsyncQueue } from "@/lib/system/queues/AppQueue";
import { bulkAddSections, bulkDeleteSections, bulkUpdateSections, removeSection, updateSection } from "@/redux/feature/redux-section-slice";
import { store } from "@/redux/store";
import { assoc, mergeRight } from "ramda";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";

const dexieInstance = new DexieDB();
const subscriptionRepo = new SubscriptionRepo(dexieInstance);
const syncQueues = new AsyncQueue();

const dispatch = store.dispatch;

const dexieSectionsRepo = dexieInstance.sectionsRepo;
const dexieMonosLinkRepo = dexieInstance.monoLinksRepo;

export async function handleCreate(section: ISection) {

    const valid = await subscriptionRepo.checkUpdateValidity("increment", "sections_count", 1);

    if(!valid) {
        AppEvents.emit(APP_EVENTS.API.SUBSCRIPTION.EXCEED, { message : "Sections limit exceeded" });
        dispatch(removeSection({ id : section.id, _skipEventPublish : true }));
        return;
    }

    syncQueues.enqueue({
        run : async () => {

            if(section.syncStatus == "synced") return;

            const updatedSection = mergeRight(section, {
                syncStatus : "pending_create",
                updatedAt : new Date().toISOString()
            } as ISection);

            await dexieSectionsRepo.addSection({
                section : updatedSection
            });

            await appSyncQueues.addToQueue({
                createdAt : new Date().getTime(),
                entity : "SECTION",
                id : section.id,
                payload : updatedSection,
                retries : 0,
                status : "PENDING",
                type : "CREATE",
                sessionId : crypto.randomUUID(),
                userId : section.userId
            })
        },
        retries : 1
    })
}

export async function handleUpdate(section: ISection) {

    if(!section.id || section.syncStatus == "sync_failed") return;

    const dexieSection = await dexieSectionsRepo.getSection(section.id);
    if(!dexieSection) return;
    
    const updatedPendingSection = mergeRight(section, {
        updatedAt : new Date().toISOString(),
        syncStatus : "pending_create",
        isDirty : true
    } as ISection)
    
    await dexieSectionsRepo.updateSection({ updatedSection : section });

    const ignoreKeys : Array<keyof ISection> = ["createdAt", "syncStatus", "syncedAt", "isMinimized", "layout"];
    if(equalsWithoutProperties(dexieSection, section, ignoreKeys)) return;

    await dexieSectionsRepo.updateSection({ updatedSection : updatedPendingSection });

    const updatedSection = mergeRight(section, {
        updatedAt : new Date().toISOString(),
        syncStatus : "pending_update",
        isDirty : true
    } as ISection)

    dispatch(updateSection({...updatedSection, _skipEventPublish : true}));
    await dexieSectionsRepo.updateSection({ updatedSection });


    // queueExists ?
    //     await appSyncQueues.updateQueue(modifiedSectionQueue as Partial<ISyncQueueItem> & Pick<ISyncQueueItem, "id" | "status">) :
    //     await appSyncQueues.addToQueue(modifiedSectionQueue as ISyncQueueItem)
}

export async function handleDelete(id : string) {
    const targetSection = await dexieSectionsRepo.getSection(id);
    if (!targetSection) return;

    const monoLinks = await dexieMonosLinkRepo.getMonoLinks(id);
    const monoLinkIds = monoLinks.map((monoLink) => monoLink.id);

    const updatedSection = assoc("syncStatus", "pending_delete", targetSection) as ISection;

    if(targetSection.syncStatus == "synced" || targetSection.syncStatus === "pending_update") {

        dispatch(updateSection(updatedSection));
        dispatch(bulkUpdateMonoLinks({ monoLinks : monoLinks.map((monoLink) => ({ id : monoLink.id, syncStatus : "pending_delete", isDirty : false, isDeleted : true })) }));
        
        await dexieSectionsRepo.updateSection({ updatedSection });

        await dexieMonosLinkRepo.bulkUpdate({ monoLinks : monoLinks.map((monoLink) => ({ id : monoLink.id, syncStatus : "pending_delete" })) });

        return;

        // await appSyncQueues.overrideQeueue({
        //     createdAt : new Date().getTime(),
        //     entity : "SECTION",
        //     id : id,
        //     payload : targetSection,
        //     retries : 0,
        //     status : "PENDING",
        //     type : "DELETE"
        // })
    }

    else {
        dispatch(removeSection({ id : id, _skipEventPublish : true }));
        dispatch(bulkDeleteMonoLinks(monoLinkIds));
        await dexieSectionsRepo.deleteSection({ id });
        await dexieMonosLinkRepo.deleteMonoLinks({ ids : monoLinkIds });
    }
}

export async function handleSync(section : ISection) {

    if(section.syncStatus == "deleted") {
        try {
            //console.log(`Syncing Deleted Section : ${section.id}`);
            await dexieSectionsRepo.deleteSection({ id : section.id });
            dispatch(removeSection({ id : section.id }));
            
            try {
                const currentSectionExistingMonoLinks = await dexieMonosLinkRepo.getMonoLinks(section.id)
                const pendingDeleteMonoLinks = currentSectionExistingMonoLinks.filter(m => m.syncStatus == "pending_delete");
                
                await dexieMonosLinkRepo.deleteMonoLinks({ ids : pendingDeleteMonoLinks.map(m => m.id) });
            }
            catch (error) {
                console.log(error)
            }

            return;
        }
        catch (error) {
            console.log(error)
            return;   
        }
    }

    const updatedSection = {
        ...section,
        syncStatus: 'synced',
        syncedAt: new Date().toISOString(),
        isDirty : false,
        version : section.version
    } as ISection;

    await dexieSectionsRepo.updateSection({ updatedSection });
    
    const dispatchSection = { ...updatedSection, _skipEventPublish: true };
    dispatch(updateSection(dispatchSection));
}

export async function handleSyncFailed(section : ISection) {
    dispatch(updateSection({
        ...section,
        syncStatus : "sync_failed",
        isDirty : false,
        _skipEventPublish : true
    }))

    await dexieSectionsRepo.updateSection({ updatedSection : {...section, syncStatus : "sync_failed", isDirty : false} });
}

type StateChanges = {
    add : ISection[], update : ISection[], deleted : string[],
}

export function handleHydrateReduxState({ add, deleted, update } : StateChanges) {
    dispatch(bulkAddSections({ sections : add, _skipEventPublish : true }));
    dispatch(bulkUpdateSections({ sections : update, _skipEventPublish : true }));
    dispatch(bulkDeleteSections(deleted));
}