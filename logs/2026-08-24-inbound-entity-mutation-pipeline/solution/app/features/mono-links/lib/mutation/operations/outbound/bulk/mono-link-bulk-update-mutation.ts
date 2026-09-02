import { bulkUpdateMonoLinks } from "@/app/features/mono-links/slices/redux-mono-links-slice";
import { IMonoLink } from "@/interface/MonoLink";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import { BulkMutationItem } from "@/lib/system/eventBus/integration/types/ReduxEventBusMiddlewareIntegration.types";
import { store } from "@/redux/store";
import { UpdateSpec } from "dexie";

const dexieInstance = new DexieDB();
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const dispatch = store.dispatch;

const E = APP_EVENTS.API["MONOLINKS"];

export async function applyMonoLinkBulkUpdateMutation(items : BulkMutationItem[]) {
    let updatedItems : { key : string, changes : UpdateSpec<IMonoLink>}[] = [];

    await dexieInstance.transaction("rw", [monoLinksRepo.monoLinks.name], async () => {

        for (const { changes, entityId, previousValue } of items) {

            if(!previousValue?.id || previousValue?.syncStatus == "sync_failed") continue;

            let isPendingCreate = false;

            const existingMonoLink = await monoLinksRepo.monoLinks.get(entityId);
            if (!existingMonoLink) {
                throw new Error(`Records with IDs ${items.map(item => item.entityId)} not found in database.`);
            }

            isPendingCreate = existingMonoLink.syncStatus == "pending_create";

            updatedItems.push({
                changes : {
                    ...changes,
                    isDirty : true,
                    updatedAt : new Date().toISOString(),
                    syncStatus : isPendingCreate ? "pending_create" : "pending_update",
                },
                key : entityId
            })
        }

        await monoLinksRepo.monoLinks.bulkUpdate(updatedItems);
    })
    
    if(updatedItems.length > 0) {
        const updatedMonolinks = updatedItems.map(item => item.changes as IMonoLink);
        dispatch(bulkUpdateMonoLinks(updatedMonolinks, { skipSync : true }));
        //AppEvents.emit(E["INTERNAL_CHANGE"], { action : "UPDATE", payload : [updatedItems] });
    }
}