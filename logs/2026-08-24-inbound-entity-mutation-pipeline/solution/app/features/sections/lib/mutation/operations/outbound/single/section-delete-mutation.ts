import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { store } from "@/redux/store";
import { ISection } from "@/interface/Section";
import { deleteSection } from "@/redux/feature/redux-section-slice";
import { SectionsRepo } from "@/lib/database/dexie-primary/repos/SectionRepo";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import { MonoLinkMutationApplierService } from "@/app/features/mono-links/lib/mutation/MonoLinkMutationApplier.service";

const dexieInstance = new DexieDB();
const sectionsRepo = new SectionsRepo(dexieInstance);
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const monoLinkMutationApplierService = new MonoLinkMutationApplierService();

const dispatch = store.dispatch;

export async function applySectionDeleteMutation(id : string) {
    try {
        let updatedPayload: (Partial<ISection> & { id: string }) | null = null;

        const pendingMonoLinkDeleteIds  = await dexieInstance.transaction("rw", [sectionsRepo.sections.name, monoLinksRepo.monoLinks.name], async () => {
            const existingSection = await sectionsRepo.sections.get(id);
            if (!existingSection) {
                throw new Error(`Record with ID ${id} not found in database.`);
            }

            const existingSectionMonoLinks = await monoLinksRepo.monoLinks.where("sectionId").equals(id).toArray();

            if(existingSection.syncStatus == "synced") {
                updatedPayload = {
                    ...existingSection,
                    id,
                    syncStatus : "pending_delete",
                    isDirty : false
                }

                await sectionsRepo.sections.update(id, updatedPayload);
            }

            else await sectionsRepo.sections.delete(id);

            return existingSectionMonoLinks.map(link => link.id);
        })
        
        if(updatedPayload) dispatch(deleteSection(id, { skipSync : true }));
        await monoLinkMutationApplierService.inbound.applyCascadeDeleteBySection(pendingMonoLinkDeleteIds);
    }
    catch (error) {
        console.error("[Section Delete] Failed to delete section", error);
        throw error;
    }
}