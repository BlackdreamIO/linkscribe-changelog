export type SyncOpType = 'CREATE' | 'UPDATE' | 'DELETE';

type BaseSyncMeta = {
    slice : string;
    entityType: "MONOLINK" | "SECTION" | (string & {});
    operation: SyncOpType;
    skipSync?: boolean;
}

export type SingleSyncMeta = BaseSyncMeta & {
    isBulk?: false;
    entityId: string;
    entityIds?: never;
}

export type BulkSyncMeta = BaseSyncMeta & {
    isBulk: true;
    entityIds: string[];
    entityId?: never;
}

export type SyncMeta = SingleSyncMeta | BulkSyncMeta;

export interface SyncOperationPayload<T = Record<string, any>> {
    id: string;
    entityType: string;
    entityId: string;
    operation: SyncOpType;
    changes: Partial<T>;
    previousValue: T | null;
    timestamp: number;
    retryCount: number;
    status: 'PENDING' | 'SYNCED' | 'FAILED';
}

// New Item Type inside Bulk Operations
export interface BulkMutationItem<T = Record<string, any>> {
    entityId: string;
    changes: Partial<T>;
    previousValue: T | null;
}

// New Bulk Payload Type
export interface BulkSyncOperationPayload<T = Record<string, any>> {
    id: string;
    entityType: string;
    operation: SyncOpType;
    items: BulkMutationItem<T>[];
    timestamp: number;
    retryCount: number;
    status: 'PENDING' | 'SYNCED' | 'FAILED';
}