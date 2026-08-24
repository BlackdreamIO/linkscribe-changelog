import type { BulkSyncOperationPayload, SyncOperationPayload } from "@/lib/system/eventBus/integration/types/ReduxEventBusMiddlewareIntegration.types";
import type { SectionReduxHydrationState } from "./operations/state/section-redux-state-hydrate";
import type { ISection, UpdateSectionFromUI } from "@/interface/Section";

import { applySectionCreateMutation } from "./operations/outbound/single/section-create-mutation";
import { applySectionUpdateMutation } from "./operations/outbound/single/section-update-mutation";
import { applySectionDeleteMutation } from "./operations/outbound/single/section-delete-mutation";

import { applySectionBulkCreateMutation } from "./operations/outbound/bulk/section-bulk-create-mutation";
import { applySectionBulkUpdateMutation } from "./operations/outbound/bulk/section-bulk-update-mutation";
import { applySectionBulkDeleteMutation } from "./operations/outbound/bulk/section-bulk-delete-mutation";

import { applySectionReduxStateHydratoion } from "./operations/state/section-redux-state-hydrate";

/**
 * -- Rules for SectionMutationApplier --
 * 1. Uniform Method Prefixing: All methods should start with apply* to establish a clear convention.
 * 2. Inbound Operations Always Pass { skipSync: true }: Every inbound method updating Redux must pass { skipSync: true } to prevent middleware re-emission.
 * 3. Custom Outbound Handlers live inside this class: If an outbound UI action needs custom side-effects (e.g., triggering a sound, updating a local IndexedDB cache,
 * or notifying a worker) before/after hitting Redux, put that custom method right inside SectionMutationApplier.
**/

export class SectionMutationApplierService {

    public outbound = {
        applySingle : async (payload: SyncOperationPayload<ISection>): Promise<void> => {
            const { operation, entityId, changes, previousValue } = payload;
            console.log(`[Section Sync] Processing single ${operation} for ID: ${entityId}`);

            const previousSnapshot = previousValue as Partial<ISection> & { id : string };

            switch (operation) {
                case "CREATE":
                    await applySectionCreateMutation(changes as ISection);
                    return;

                case "UPDATE":
                    await applySectionUpdateMutation({ id : entityId, changes : changes as UpdateSectionFromUI, previousSnapshot });
                    return;

                case "DELETE":
                    await applySectionDeleteMutation(entityId);
                    return;

                default:
                    this.unhandledOperation(operation);
            }
        },
        applyBulk : async (payload: BulkSyncOperationPayload<ISection>): Promise<void> => {
            const { operation, items } = payload;
            console.log(`[Section Sync] Processing bulk ${operation} for ${items.length} items`);

            switch (operation) {
                case "CREATE":
                    await applySectionBulkCreateMutation(items.map((item) => item.changes as ISection));
                    return;

                case "UPDATE":
                    await applySectionBulkUpdateMutation(items);
                    return;

                case "DELETE":
                await applySectionBulkDeleteMutation(items);
                    return;

                default:
                    this.unhandledOperation(operation);
            }
        }
    }

    public applyStateHydration (args : SectionReduxHydrationState) {
        applySectionReduxStateHydratoion(args);
    }

    private unhandledOperation(operation : string) : void {
        throw new Error(`[Section Sync] Unhandled operation: ${operation}`);
    }
}