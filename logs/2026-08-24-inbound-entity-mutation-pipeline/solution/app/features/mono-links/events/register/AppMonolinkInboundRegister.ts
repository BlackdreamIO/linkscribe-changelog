import { registerAppEventDriver } from "@/lib/system/eventBus/drivers/AppEventDriver";
import { MonoLinkMutationApplierService } from "../../lib/mutation/MonoLinkMutationApplier.service";
import { MonoLinkReduxHydrationState } from "../../lib/mutation/operations/state/mono-link-redux-state-hydrate";
import { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";

const monoLinkMutationApplierService = new MonoLinkMutationApplierService();

/**
 * Registers inbound event listeners for the mono-links feature.
 *
 * This handler listens for events emitted by external systems (such as Web Workers,
 * background sync services, or server web sockets) and delegates the necessary state 
 * updates to the MonoLinkMutationApplierService.
 *
 * Must be executed once during app initialization.
 */
export function AppMonoLinkInboundRegister() {
    registerAppEventDriver({
        listenTo: APP_EVENTS.API["MONOLINKS"]["SYNC"],
        handler: async (args: MonoLinkReduxHydrationState) => {
            console.log(`syncing monolink state `, {
                args
            })
            await monoLinkMutationApplierService.applyStateHydration(args);
            // FUTURE LOGIC
        },
    });

    registerAppEventDriver({
        listenTo: "SYNC_FAILED",
        handler: async (payload: { entityId: string; error: string }) => {
            // FUTURE LOGIC
        },
    });
}