import { Middleware } from '@reduxjs/toolkit';
import AppEvents, { APP_EVENTS } from '../AppEventBus';
import { 
    BulkMutationItem,
    BulkSyncOperationPayload,
    SyncMeta,
    SyncOpType,
    SyncOperationPayload
} from "./types/ReduxEventBusMiddlewareIntegration.types";
import { RootState } from '@/redux/store';

export const ReduxEventBusMiddleware : Middleware = (store) => (next) => (action: any) => {
    const syncMeta = action.meta?.sync as SyncMeta | undefined;

    // 🛑 Skip non-sync actions or subscriber-originated actions (circuit breaker)
    if (!syncMeta || action.meta?.skipSync) {
        return next(action);
    }

    const { entityType, operation, isBulk, entityId, entityIds, slice } = syncMeta;
    const stateBefore = store.getState();
    const result = next(action);
    const stateAfter = store.getState();

    const getEntity = (state : any, id: string) => state[slice as keyof RootState]?.entities?.[id] ?? null;

    const getMutationData = (entityId: string, op: SyncOpType) => {
        const previousValue = getEntity(stateBefore, entityId);
        const currentValue = getEntity(stateAfter, entityId);

        if (op === 'UPDATE' && (!previousValue || !currentValue)) return null;
        if (op === 'DELETE' && !previousValue) return null;
        if (op === 'CREATE' && !currentValue) return null;

        let changes: Record<string, any> = {};

        if (op === 'CREATE') changes = { ...currentValue };
        else if (op === 'UPDATE') {
            changes = calculateDelta(previousValue, currentValue);
            if (Object.keys(changes).length === 0) return null;
        }

        return { entityId, changes, previousValue };
    }

    const now = Date.now();

    if (isBulk && Array.isArray(entityIds) && entityIds.length > 0) {
        const items: BulkMutationItem[] = entityIds
            .map((id) => getMutationData(id, operation))
            .filter((item): item is BulkMutationItem => item !== null);

        if (items.length > 0) {
            const bulkPayload: BulkSyncOperationPayload = {
                id: crypto.randomUUID(),
                entityType,
                operation,
                items,
                timestamp: now,
                retryCount: 0,
                status: 'PENDING',
            }

            console.log('emitting bulk mutation', { bulkPayload });
            AppEvents.emit(APP_EVENTS.API.REDUX["BULK_ENTITY_MUTATED"], bulkPayload);
        }
    }

    if (entityId) {
        const mutation = getMutationData(entityId, operation);
        if(mutation) {
            const singlePayload: SyncOperationPayload = {
                id: crypto.randomUUID(),
                entityType,
                entityId: mutation.entityId,
                operation,
                changes: mutation.changes,
                previousValue: mutation.previousValue,
                timestamp: now,
                retryCount: 0,
                status: 'PENDING',
            };
            console.log('emitting single mutation', { singlePayload });
            AppEvents.emit(APP_EVENTS.API.REDUX["ENTITY_MUTATED"], singlePayload);
        }
    }

    return result;
}

function calculateDelta<T extends Record<string, any>>(before: T, after: T): Partial<T> {
    const changes: Partial<T> = {};
    if (!before || !after) return changes;
    for (const key of Object.keys(after)) {
        if (before[key] !== after[key]) {
            changes[key as keyof T] = after[key];
        }
    }
    return changes;
}