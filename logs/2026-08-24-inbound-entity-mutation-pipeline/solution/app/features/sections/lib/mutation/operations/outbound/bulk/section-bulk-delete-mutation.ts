import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { store } from "@/redux/store";
import { BulkMutationItem } from "@/lib/system/eventBus/integration/types/ReduxEventBusMiddlewareIntegration.types";
import { SectionsRepo } from "@/lib/database/dexie-primary/repos/SectionRepo";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import { ISection } from "@/interface/Section";
import { bulkDeleteSections } from "@/redux/feature/redux-section-slice";
import { MonoLinkMutationApplierService } from "@/app/features/mono-links/lib/mutation/MonoLinkMutationApplier.service";

const dexieInstance = new DexieDB();
const sectionsRepo = new SectionsRepo(dexieInstance);
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const monoLinkMutationApplierService = new MonoLinkMutationApplierService();

const dispatch = store.dispatch;

export async function applySectionBulkDeleteMutation(items: BulkMutationItem[]) {
    try {
        let updatedPayload: (Partial<ISection> & { id: string })[] = [];
        const toDelete : string[] = [];

        const pendingMonoLinkDeleteIds = await dexieInstance.transaction("rw", [sectionsRepo.sections.name, monoLinksRepo.monoLinks.name], async () => {
            const pendingMonoLinkDeleteIds : string[] = [];

            for(const { entityId } of items) {

                const existingSection = await sectionsRepo.sections.get(entityId);
                if (!existingSection) throw new Error(`Record with ID ${entityId} not found in database.`);

                const existingSectionMonoLinks = await monoLinksRepo.monoLinks.where("sectionId").equals(entityId).toArray();

                if(existingSection?.syncStatus == "synced") {
                    const updatedSection = {
                        ...existingSection,
                        id : entityId,
                        syncStatus : "pending_delete",
                        isDirty : false
                    } as (Partial<ISection> & { id: string })

                    updatedPayload.push(updatedSection);
                }
                
                else toDelete.push(entityId);

                pendingMonoLinkDeleteIds.push(...existingSectionMonoLinks.map(link => link.id));
            }

            await sectionsRepo.sections.bulkUpdate(updatedPayload.map((item) => ({ key : item.id, changes : item })));
            await sectionsRepo.sections.bulkDelete(toDelete);

            return pendingMonoLinkDeleteIds;
        })
        
        if(updatedPayload) {
            dispatch(bulkDeleteSections(toDelete, { skipSync : true }));
        }

        await monoLinkMutationApplierService.inbound.applyCascadeDeleteBySection(pendingMonoLinkDeleteIds);
    }
    catch (error) {
        console.error("[Section Bulk Delete] Failed to delete sections", error);
        throw error;
    }
}