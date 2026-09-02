import { registerAppEventDriver } from "@/lib/system/eventBus/drivers/AppEventDriver";
import { SectionMutationApplierService } from "../../lib/mutation/SectionMutationApplier.service";
import { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";
import type { SectionReduxHydrationState } from "../../lib/mutation/operations/state/section-redux-state-hydrate";

const sectionMutationApplierService = new SectionMutationApplierService();

/**
 * Registers inbound event listeners for the sections feature.
 *
 * This handler listens for events emitted by external systems (such as Web Workers,
 * background sync services, or server web sockets) and delegates the necessary state 
 * updates to the SectionMutationApplierService.
 *
 * Must be executed once during app initialization.
 */
export function AppSectionInboundRegister() {
    registerAppEventDriver({
        listenTo: APP_EVENTS.API["SECTIONS"]["SYNC"],
        handler: async (args: SectionReduxHydrationState) => {
            sectionMutationApplierService.applyStateHydration(args);
            // Future Logic
        },
    });

    registerAppEventDriver({
        listenTo: "SYNC_FAILED",
        handler: async (payload: { entityId: string; error: string }) => {
            // Future Logic
        },
    });
}