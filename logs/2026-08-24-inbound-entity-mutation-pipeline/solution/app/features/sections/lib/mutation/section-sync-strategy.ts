import { EntityMutationHandler } from "@/interface/sync/EntityMutationHandler.types";
import { SectionMutationApplierService } from "./SectionMutationApplier.service";
import { ISection } from "@/interface/Section";

const sectionMutationApplierService = new SectionMutationApplierService();

export const sectionSyncStrategy : EntityMutationHandler<ISection> = {
    entityType: "SECTION",
    
    async handleSingle(payload) {
        await sectionMutationApplierService.outbound.applySingle(payload);
    },

    async handleBulk(payload) {
        await sectionMutationApplierService.outbound.applyBulk(payload);
    }
}