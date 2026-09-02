import { IMonoLink } from "@/interface/MonoLink";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import { store } from "@/redux/store";
import { bulkDeleteMonoLinks } from "../../../../../slices/redux-mono-links-slice";

const dexieInstance = new DexieDB();
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const dispatch = store.dispatch;

const E = APP_EVENTS.API["MONOLINKS"];

export async function applyMonoLinkBulkDeleteMutation(items: string[]) {
    try {
        let updatedPayload: (Partial<IMonoLink> & { id: string })[] = [];
        const toDelete : string[] = [];

        await dexieInstance.transaction("rw", [monoLinksRepo.monoLinks.name], async () => {
            for(const id of items) {

                const existingMonoLink = await monoLinksRepo.monoLinks.get(id);
                if (!existingMonoLink) throw new Error(`Record with ID ${id} not found in database.`);

                if(existingMonoLink?.syncStatus == "synced") {
                    const updatedMonoLink = {
                        ...existingMonoLink,
                        id : id,
                        syncStatus : "pending_delete",
                        isDirty : false
                    } as (Partial<IMonoLink> & { id: string })

                    updatedPayload.push(updatedMonoLink);
                }
                
                else toDelete.push(id);
            }

            await monoLinksRepo.monoLinks.bulkUpdate(updatedPayload.map((item) => ({ key : item.id, changes : item })));
            await monoLinksRepo.monoLinks.bulkDelete(toDelete);
        })
        
        if(updatedPayload) {
            dispatch(bulkDeleteMonoLinks(toDelete, { skipSync : true }));
            //AppEvents.emit(APP_EVENTS.API.MONOLINKS.INTERNAL_CHANGE, { action : "DELETE", payload : [id] });
        }
    }
    catch (error) {
        console.error("[MonoLink Bulk Sync] Failed to delete mono-links", error);
        throw error;
    }
}