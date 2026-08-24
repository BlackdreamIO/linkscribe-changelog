import { IMonoLink, UpdateMonoLinkFromUI } from "@/interface/MonoLink";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import { store } from "@/redux/store";
import { updateMonoLink } from "../../../../../slices/redux-mono-links-slice";

const dexieInstance = new DexieDB();
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const dispatch = store.dispatch;

const E = APP_EVENTS.API["MONOLINKS"];

type UpdateMutationArgs = {
    changes : UpdateMonoLinkFromUI;
    previousSnapshot : Partial<IMonoLink> & { id : string };
    id : string;
}

export async function applyMonoLinkUpdateMutation({ changes, id, previousSnapshot } : UpdateMutationArgs) {
    if(!previousSnapshot.id || previousSnapshot?.syncStatus == "sync_failed") return;
    try {
        let updatedPayload: (Partial<IMonoLink> & { id: string }) | null = null;
        let isPendingCreate = false;

        await dexieInstance.transaction("rw", [monoLinksRepo.monoLinks.name], async () => {
            const existingMonoLink = await monoLinksRepo.monoLinks.get(id);
            if (!existingMonoLink) {
                throw new Error(`Record with ID ${id} not found in database.`);
            }

            isPendingCreate = existingMonoLink.syncStatus == "pending_create";

            updatedPayload = {
                ...changes,
                isDirty : true,
                updatedAt : new Date().toISOString(),
                syncStatus : isPendingCreate ? "pending_create" : "pending_update",
            } as Partial<IMonoLink> & { id : string};
            
            await monoLinksRepo.monoLinks.update(id, updatedPayload);
        })
        
        if(updatedPayload) {
            dispatch(updateMonoLink(updatedPayload, { skipSync : true }));
            AppEvents.emit(E["INTERNAL_CHANGE"], { action: "UPDATE", payload: [updatedPayload] });
        }
    }
    catch (error) {
        console.error("[MonoLink Sync] Failed to update mono-link", error);
        throw error;
    }
}