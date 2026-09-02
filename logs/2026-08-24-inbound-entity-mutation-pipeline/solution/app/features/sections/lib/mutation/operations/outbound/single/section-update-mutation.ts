import { ISection, UpdateSectionFromUI } from "@/interface/Section";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { SectionsRepo } from "@/lib/database/dexie-primary/repos/SectionRepo";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import { updateSection } from "@/redux/feature/redux-section-slice";
import { store } from "@/redux/store";

const dexieInstance = new DexieDB();
const sectionsRepo = new SectionsRepo(dexieInstance);

const dispatch = store.dispatch;

type UpdateMutationArgs = {
    changes : UpdateSectionFromUI;
    previousSnapshot : Partial<ISection> & { id : string };
    id : string;
}

export async function applySectionUpdateMutation({ changes, id, previousSnapshot } : UpdateMutationArgs) {
    if(!previousSnapshot.id || previousSnapshot?.syncStatus == "sync_failed") return;
    try {
        let updatedPayload: (Partial<ISection> & { id: string }) | null = null;
        let isPendingCreate = false;

        await dexieInstance.transaction("rw", [sectionsRepo.sections.name], async () => {
            const existingSection = await sectionsRepo.sections.get(id);
            if (!existingSection) {
                throw new Error(`Record with ID ${id} not found in database.`);
            }

            isPendingCreate = existingSection.syncStatus == "pending_create";

            updatedPayload = {
                ...changes,
                isDirty : true,
                updatedAt : new Date().toISOString(),
                syncStatus : isPendingCreate ? "pending_create" : "pending_update",
            } as Partial<ISection> & { id : string};
            
            await sectionsRepo.sections.update(id, updatedPayload);
        })
        
        if(updatedPayload) {
            dispatch(updateSection(updatedPayload, { skipSync : true }));
            //AppEvents.emit(E["INTERNAL_CHANGE"], { action: "UPDATE", payload: [updatedPayload] });
        }
    }
    catch (error) {
        console.error("[Section Sync] Failed to update section", error);
        throw error;
    }
}