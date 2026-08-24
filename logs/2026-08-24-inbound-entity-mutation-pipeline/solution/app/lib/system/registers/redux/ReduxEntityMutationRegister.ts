import { EntityMutationRouter } from "@/lib/system/sync/routing/EntityMutationRouter.service";
import { APP_EVENTS } from "../../AppEventBus";
import { defineEvents } from "../../base/DefineEvents";
import { BulkSyncOperationPayload, SyncOperationPayload } from "../../integration/types/ReduxEventBusMiddlewareIntegration.types";

export function AppReduxEntityMutationRegister () {
    const entityMutationRouter = EntityMutationRouter.getInstance();

    defineEvents(({ on }) => {
        on(APP_EVENTS.API.REDUX["ENTITY_MUTATED"], async (payload) => {
            await entityMutationRouter.routeSingle(payload as SyncOperationPayload);
        })
        on(APP_EVENTS.API.REDUX["BULK_ENTITY_MUTATED"], async (payload) => {
            await entityMutationRouter.routeBulk(payload as BulkSyncOperationPayload);
        })
    })
}