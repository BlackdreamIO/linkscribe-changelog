import type { IMonoLink, UpdateMonoLinkFromUI } from "@/interface/MonoLink";
import type { BulkSyncOperationPayload, SyncOperationPayload } from "@/lib/system/eventBus/integration/types/ReduxEventBusMiddlewareIntegration.types";
import type { MonoLinkReduxHydrationState } from "./operations/state/mono-link-redux-state-hydrate";

import { applyMonoLinkCreateMutation } from "./operations/outbound/single/mono-link-create-mutation";
import { applyMonoLinkUpdateMutation } from "./operations/outbound/single/mono-link-update-mutation";
import { applyMonoLinkDeleteMutation } from "./operations/outbound/single/mono-link-delete-mutation";

import { applyMonoLinkBulkCreateMutation } from "./operations/outbound/bulk/mono-link-bulk-create-mutation";
import { applyMonoLinkBulkUpdateMutation } from "./operations/outbound/bulk/mono-link-bulk-update-mutation";
import { applyMonoLinkBulkDeleteMutation } from "./operations/outbound/bulk/mono-link-bulk-delete-mutation";

import { applyMonoLinkReduxStateHydratoion } from "./operations/state/mono-link-redux-state-hydrate";
import { applyInboundMonoLinkUpdateMutation } from "./operations/inbound/applyInboundUpdateMutation";
import { applyInboundFeaturePatchMutation, FeaturePatchItem } from "./operations/inbound/applyInboundFeaturePatchMutation";

/**
 * -- Rules for MonoLinkMutationApplier --
 * 1. Uniform Method Prefixing: All methods should start with apply* to establish a clear convention.
 * 2. Inbound Operations Always Pass { skipSync: true }: Every inbound method updating Redux must pass { skipSync: true } to prevent middleware re-emission.
 * 3. Custom Outbound Handlers live inside this class: If an outbound UI action needs custom side-effects (e.g., triggering a sound, updating a local IndexedDB cache,
 * or notifying a worker) before/after hitting Redux, put that custom method right inside MonoLinkMutationApplier.
**/

export class MonoLinkMutationApplierService {

    public outbound = {
        applySingle : async (payload: SyncOperationPayload<IMonoLink>) : Promise<void> =>  {
            const { operation, entityId, changes, previousValue } = payload;
            console.log(`[MonoLink Sync] Processing single ${operation} for ID: ${entityId}`);

            const previousSnapshot = previousValue as Partial<IMonoLink> & { id : string };

            switch (operation) {
                case "CREATE":
                    await applyMonoLinkCreateMutation(changes as IMonoLink);
                    return;

                case "UPDATE":
                    await applyMonoLinkUpdateMutation({ id : entityId, changes : changes as UpdateMonoLinkFromUI, previousSnapshot });
                    return;

                case "DELETE":
                    await applyMonoLinkDeleteMutation(entityId);
                    return;

                default:
                    this.unhandledOperation(operation);
            }
        },
        applyBulk : async (payload: BulkSyncOperationPayload<IMonoLink>) : Promise<void> => {
            const { operation, items } = payload;
            console.log(`[MonoLink Sync] Processing bulk ${operation} for ${items.length} items`);

            switch (operation) {
                case "CREATE":
                    await applyMonoLinkBulkCreateMutation(items.map((item) => item.changes as IMonoLink));
                    return;

                case "UPDATE":
                    await applyMonoLinkBulkUpdateMutation(items);
                    return;

                case "DELETE":
                    await applyMonoLinkBulkDeleteMutation(items.map(i => i.entityId));
                    return;

                default:
                    this.unhandledOperation(operation);
            }
        }
    }

    public inbound = { 
        async applyRemoteUpdate (changes : Array<{ id: string; changes: Partial<IMonoLink> }>) {
            await applyInboundMonoLinkUpdateMutation(changes);
        },
        async applyFeaturePatch (patches: FeaturePatchItem[]) {
            await applyInboundFeaturePatchMutation(patches);
        },
        async applyCascadeDeleteBySection (ids: string[]) : Promise<void> {
            await applyMonoLinkBulkDeleteMutation(ids);
        }
    }

    public applyStateHydration (args : MonoLinkReduxHydrationState) {
        applyMonoLinkReduxStateHydratoion(args);
    }

    private unhandledOperation(operation : string) : void {
        throw new Error(`[MonoLink Sync] Unhandled operation: ${operation}`);
    }
}