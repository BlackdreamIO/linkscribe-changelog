import { IMonoLink } from "@/interface/MonoLink";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import { store } from "@/redux/store";
import { deleteMonoLink } from "../../../../../slices/redux-mono-links-slice";

const dexieInstance = new DexieDB();
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const dispatch = store.dispatch;

const E = APP_EVENTS.API["MONOLINKS"];

export async function applyMonoLinkDeleteMutation(id : string) {
    try {
        let updatedPayload: (Partial<IMonoLink> & { id: string }) | null = null;

        await dexieInstance.transaction("rw", [monoLinksRepo.monoLinks.name], async () => {
            const existingMonoLink = await monoLinksRepo.monoLinks.get(id);
            if (!existingMonoLink) {
                throw new Error(`Record with ID ${id} not found in database.`);
            }

            if(existingMonoLink.syncStatus == "synced") {
                updatedPayload = {
                    ...existingMonoLink,
                    id,
                    syncStatus : "pending_delete",
                    isDirty : false
                }

                await monoLinksRepo.monoLinks.update(id, updatedPayload);
            }

            else await monoLinksRepo.monoLinks.delete(id);
        })
        
        if(updatedPayload) {
            dispatch(deleteMonoLink(id, { skipSync : true }));
            AppEvents.emit(APP_EVENTS.API.MONOLINKS.INTERNAL_CHANGE, { action : "DELETE", payload : [id] });
        }
    }
    catch (error) {
        console.error("[MonoLink Delete Sync] Failed to delete mono-link", error);
        throw error;
    }
}