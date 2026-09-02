import { IMonoLink } from "@/interface/MonoLink";
import { EntityMutationHandler } from "@/interface/sync/EntityMutationHandler.types";
import { MonoLinkMutationApplierService } from "./MonoLinkMutationApplier.service";

const monoLinkMutationApplierService = new MonoLinkMutationApplierService();

export const monolinkSyncStrategy : EntityMutationHandler<IMonoLink> = {
    entityType: "MONOLINK",
    
    async handleSingle(payload) {
        await monoLinkMutationApplierService.outbound.applySingle(payload);
    },

    async handleBulk(payload) {
        await monoLinkMutationApplierService.outbound.applyBulk(payload);
    }
}