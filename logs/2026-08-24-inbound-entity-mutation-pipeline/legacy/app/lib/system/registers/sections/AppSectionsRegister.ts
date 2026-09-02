import { registerAppEventDriver } from "@/lib/system/eventBus/drivers/AppEventDriver";
import * as sectionHandlers from "./helpers/section-register-handler";
import { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import { registerBroadcastEventDriver } from "@/lib/system/eventBus/drivers/AppBroadcastDriver";

export async function AppSectionsRegister() {

    // Create
    registerAppEventDriver({
        listenTo: APP_EVENTS.API.SECTIONS.CREATE,
        triggerTo: APP_EVENTS.SECTIONS.ON_CREATE,
        triggerPayload : "SELF",
        handler: sectionHandlers.handleCreate
    })

    // Update
    registerAppEventDriver({
        listenTo: APP_EVENTS.API.SECTIONS.UPDATE,
        triggerTo: APP_EVENTS.SECTIONS.ON_UPDATE,
        triggerPayload : "SELF",
        handler: sectionHandlers.handleUpdate
    })

    // Delete
    registerAppEventDriver({
        listenTo: APP_EVENTS.API.SECTIONS.DELETE,
        triggerTo: APP_EVENTS.SECTIONS.ON_DELETE,
        triggerPayload : "SELF",
        handler: sectionHandlers.handleDelete
    })

    // Sync
    registerAppEventDriver({
        listenTo: APP_EVENTS.API.SECTIONS.SYNC,
        handler: sectionHandlers.handleSync
    })

    // Sync Failed
    registerAppEventDriver({
        listenTo: APP_EVENTS.API.SECTIONS.SYNC_FAILED,
        handler: sectionHandlers.handleSyncFailed
    })

    // Worker Sync Redux State Update
    registerBroadcastEventDriver({
        listenTo: APP_EVENTS.API.APP_SYNC_ENGINE.NOTIFY_REDUX_STATE,
        handler: async (payload : unknown) => {
    
            //console.log(`STATE NOTIFY [SECTIONS REGISTER] > MAIN_THREAD`);

            const { added, updates, deletes } = payload as { added : { sections : any[] }, updates : { sections : any[] }, deletes : { sections : string[] } };

            sectionHandlers.handleHydrateReduxState({
                add : added.sections,
                update : updates.sections,
                deleted : deletes.sections
            })
        }
    })
}