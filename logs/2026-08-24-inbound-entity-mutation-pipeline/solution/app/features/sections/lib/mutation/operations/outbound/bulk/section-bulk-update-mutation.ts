import { ISection } from "@/interface/Section";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { SectionsRepo } from "@/lib/database/dexie-primary/repos/SectionRepo";
import { BulkMutationItem } from "@/lib/system/eventBus/integration/types/ReduxEventBusMiddlewareIntegration.types";
import { bulkUpdateSections } from "@/redux/feature/redux-section-slice";
import { store } from "@/redux/store";
import { UpdateSpec } from "dexie";

const dexieInstance = new DexieDB();
const sectionsRepo = new SectionsRepo(dexieInstance);

const dispatch = store.dispatch;

export async function applySectionBulkUpdateMutation(items : BulkMutationItem[]) {
    let updatedItems : { key : string, changes : UpdateSpec<ISection>}[] = [];

    await dexieInstance.transaction("rw", [sectionsRepo.sections.name], async () => {

        for (const { changes, entityId, previousValue } of items) {

            if(!previousValue?.id || previousValue?.syncStatus == "sync_failed") continue;

            let isPendingCreate = false;

            const existingMonoLink = await sectionsRepo.sections.get(entityId);
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

        await sectionsRepo.sections.bulkUpdate(updatedItems);
    })
    
    if(updatedItems.length > 0) {
        const updatedSections = updatedItems.map(item => item.changes as ISection);
        dispatch(bulkUpdateSections(updatedSections, { skipSync : true }));
    }
}