import { EntityMutationHandler } from "@/interface/sync/EntityMutationHandler.types";
import { BulkSyncOperationPayload, SyncOperationPayload } from "../../eventBus/integration/types/ReduxEventBusMiddlewareIntegration.types";

/**
 * Singleton router that registers entity mutation handlers and dispatches single or bulk sync sync payloads to them.
**/

export class EntityMutationRouter {
    private handlers = new Map<string, EntityMutationHandler>();
    private static instance: EntityMutationRouter;

    private constructor() {}

    public static getInstance () : EntityMutationRouter {
        if (!EntityMutationRouter.instance) {
            EntityMutationRouter.instance = new EntityMutationRouter();
        }
        return EntityMutationRouter.instance;
    }

    public register(handler: EntityMutationHandler): void {
        if (this.handlers.has(handler.entityType)) {
            console.warn(`[MutationRouter] Overwriting handler for entityType: ${handler.entityType}`);
        }
        this.handlers.set(handler.entityType, handler);
    }

    public async routeSingle(payload: SyncOperationPayload): Promise<void> {
        const handler = this.handlers.get(payload.entityType);
        if (!handler) {
            console.debug(`[MutationRouter] No handler registered for entityType: ${payload.entityType}`);
            return;
        }

        if (handler.handleSingle) {
            await handler.handleSingle(payload);
        }
    }

    public async routeBulk(payload: BulkSyncOperationPayload): Promise<void> {
        const handler = this.handlers.get(payload.entityType);
        if (!handler) {
            console.debug(`[MutationRouter] No handler registered for entityType: ${payload.entityType}`);
            return;
        }

        if (handler.handleBulk) {
            await handler.handleBulk(payload);
        }
    }
}