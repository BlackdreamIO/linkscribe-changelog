import * as monoLinkHandlers from "./helpers/mono-links-register-handler";
import { MonoLinkPipeline } from "../../apps/web/src/app/features/mono-links/events/pipeline/mono-link-pipeline";
import { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import { registerAppEventDriver } from "@/lib/system/eventBus/drivers/AppEventDriver";
import { registerBroadcastEventDriver } from "@/lib/system/eventBus/drivers/AppBroadcastDriver";

export async function AppMonoLinkRegister() {

    const E = APP_EVENTS.API;

    // Create
    registerAppEventDriver({
        listenTo: E['MONOLINKS']['CREATE'],
        triggerTo: APP_EVENTS.MONOLINKS.ON_CREATE,
        triggerPayload : "SELF",
        handler: monoLinkHandlers.handleCreate
    })

    // Bulk Create
    registerAppEventDriver({
        listenTo: E['MONOLINKS']['BULK_CREATE'],
        triggerTo: APP_EVENTS.MONOLINKS.ON_BULK_CREATE,
        triggerPayload : "SELF",
        handler: monoLinkHandlers.handleBulkCreate
    })

    // Update
    registerAppEventDriver({
        listenTo: E['MONOLINKS']['UPDATE'],
        triggerTo: APP_EVENTS.MONOLINKS.ON_UPDATE,
        triggerPayload : "SELF",
        handler: monoLinkHandlers.handleUpdate
    })

    // Bulk Update
    // registerAppEventDriver({
    //     listenTo: E['MONOLINKS']['BULK_UPDATE'],
    //     triggerTo: APP_EVENTS.MONOLINKS.ON_UPDATE,
    //     triggerPayload : "SELF",
    //     handler: monoLinkHandlers.handleBulkUpdate
    // })

    // Delete
    registerAppEventDriver({
        listenTo: E['MONOLINKS']['DELETE'],
        triggerTo: APP_EVENTS.MONOLINKS.ON_DELETE,
        triggerPayload : "SELF",
        handler: monoLinkHandlers.handleDelete
    })

    // Bulk Delete
    registerAppEventDriver({
        listenTo: E['MONOLINKS']['BULK_DELETE'],
        triggerTo: APP_EVENTS.MONOLINKS.ON_DELETE,
        triggerPayload : "SELF",
        handler: monoLinkHandlers.handleBulkDelete
    })

    // Sync
    registerAppEventDriver({
        listenTo: E['MONOLINKS']['SYNC'],
        handler: monoLinkHandlers.handleSync
    })

    // Sync Failed
    registerAppEventDriver({
        listenTo: E['MONOLINKS']['SYNC_FAILED'],
        handler: monoLinkHandlers.handleSyncFailed
    })

    // Sync Redux State Update
    registerAppEventDriver({
        listenTo: E['APP_SYNC_ENGINE']['NOTIFY_REDUX_STATE'],
        handler: async (payload : unknown) => {
            const { added, updates, deletes, mainThread } = payload as { added : { monoLinks : any[] }, updates : { monoLinks : any[] }, deletes : { monoLinks : string[] }, mainThread : boolean };
            
            if(mainThread) {
                monoLinkHandlers.handleHydrateReduxState({add : added.monoLinks, update : updates.monoLinks, deleted : deletes.monoLinks});   
            }
        } 
    })
    // Worker Sync Redux State Update
    registerBroadcastEventDriver({
        listenTo: E['APP_SYNC_ENGINE']['NOTIFY_REDUX_STATE'],
        handler: async (payload : unknown) => {
            const { added, updates, deletes, mainThread } = payload as { added : { monoLinks : any[] }, updates : { monoLinks : any[] }, deletes : { monoLinks : string[] }, mainThread : boolean };

            if(mainThread) return;
            //console.log(`STATE NOTIFY [MONOLINKS REGISTER] > MAIN_THREAD`);
            
            monoLinkHandlers.handleHydrateReduxState({
                add : added.monoLinks,
                update : updates.monoLinks,
                deleted : deletes.monoLinks
            })
        }
    })

    MonoLinkPipeline();
}
