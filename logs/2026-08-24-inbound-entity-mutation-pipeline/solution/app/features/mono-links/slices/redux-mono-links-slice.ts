import { EntityState, PayloadAction, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { CreateMonoLinkFromUI, IMonoLink, UpdateMonoLinkFromUI } from '@/interface/MonoLink';
import { createSliceSyncMetaFactory } from '@/redux/helpers/createSyncMetaFactory';
import { RootState } from '@/redux/store';

export const monoLinkAdapter = createEntityAdapter<IMonoLink, string>({
    selectId: (monoLink) => monoLink.id,
    sortComparer: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
})

export interface IMonoLinksState extends EntityState<IMonoLink, string> {
    monoLinks : IMonoLink[];
    isEmpty : boolean;
    loading: boolean;
    error: string | null;
}

interface IOptions {
    skipSync? : boolean;
}

const initialState : IMonoLinksState = monoLinkAdapter.getInitialState({
    monoLinks: [],
    isEmpty: true,
    loading: false,
    error: null
})

const SLICE_NAME = 'monoLinksSlice';

const buildMonolinkSyncMeta = createSliceSyncMetaFactory();

const monoLinkSlice = createSlice({
    name: SLICE_NAME,
    initialState,
    reducers: {
        hydrateMonoLinks(state, action: PayloadAction<IMonoLink[]>) {
            monoLinkAdapter.upsertMany(state, action.payload)
        },
        addMonoLink : {
            reducer: (state, action: PayloadAction<IMonoLink>) => {
                monoLinkAdapter.addOne(state, action)
            },
            prepare: (payload: CreateMonoLinkFromUI, options?: IOptions) => {
                const id = crypto.randomUUID();
                const now = new Date().toISOString();

                const newMonoLink: IMonoLink = {
                    ...payload,
                    id,
                    version: 1,
                    syncStatus: 'pending_create',
                    isDirty: false,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now,

                    sharedId: `pending_${id}`, 
                    orderKey: `local_${Date.now()}`,
                };
                
                return {
                    payload : newMonoLink,
                    meta : buildMonolinkSyncMeta({
                        operation: 'CREATE',
                        entityId: newMonoLink.id,
                        isBulk: false,
                        entityType : "MONOLINK",
                        slice : SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    })
                }
            },
        },
        updateMonoLink: {
            reducer: (state, action: PayloadAction<{ id: string; changes: Partial<IMonoLink> }>) => {
                monoLinkAdapter.updateOne(state, action);
            },
            prepare: (payload: UpdateMonoLinkFromUI, options? : IOptions) => ({
                payload: {
                    id: payload.id,
                    changes: {
                        ...payload,
                        isDirty: true,
                        updatedAt: new Date().toISOString(),
                    } as Partial<IMonoLink>,
                },
                meta : buildMonolinkSyncMeta({
                    operation: 'UPDATE',
                    entityId: payload.id,
                    isBulk: false,
                    entityType : "MONOLINK",
                    slice : SLICE_NAME,
                    skipSync : options?.skipSync ?? false
                })
            }),
        },
        deleteMonoLink : {
            reducer(state, action: PayloadAction<string>) {
                monoLinkAdapter.removeOne(state, action);
            },
            prepare(id : string, options? : IOptions) {
                return {
                    payload: id,
                    meta : buildMonolinkSyncMeta({
                        operation: 'DELETE',
                        entityId: id,
                        isBulk: false,
                        entityType : "MONOLINK",
                        slice : SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    })
                }
            },
        },
        // ------------------ BULK ---------------------//
        bulkAddMonoLinks: {
            reducer: (state, action: PayloadAction<IMonoLink[]>) => {
                monoLinkAdapter.addMany(state, action);
            },
            prepare: (payloads: CreateMonoLinkFromUI[], options? : IOptions) => {
                const now = new Date().toISOString();
                const newMonoLinks: IMonoLink[] = payloads.map((payload) => {
                    if ('id' in payload && payload.id) {
                        return payload as IMonoLink;
                    }

                    const id = crypto.randomUUID();
                    return {
                        ...payload,
                        id,
                        version: 1,
                        syncStatus: 'pending_create',
                        isDirty: false,
                        isDeleted: false,
                        createdAt: now,
                        updatedAt: now,
                        sharedId: `pending_${id}`,
                        orderKey: `local_${Date.now()}`,
                    };
                });

                return {
                    payload: newMonoLinks,
                    meta: buildMonolinkSyncMeta({
                        operation: 'CREATE',
                        entityIds: newMonoLinks.map((item) => item.id),
                        isBulk: true,
                        entityType: 'MONOLINK',
                        slice: SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    }),
                };
            },
        },
        bulkUpdateMonoLinks : {
            reducer: (state, action: PayloadAction<{ id: string; changes: Partial<IMonoLink> }[]>) => {
                monoLinkAdapter.updateMany(state, action);
            },
            prepare: (updatedLinks: UpdateMonoLinkFromUI[], options? : IOptions) => ({
                payload: updatedLinks.map(link => ({
                    id: link.id,
                    changes: {
                        ...link,
                        isDirty: true,
                        updatedAt: new Date().toISOString(),
                    } as Partial<IMonoLink>,
                })),
                meta : buildMonolinkSyncMeta({
                    operation: 'UPDATE',
                    entityIds: updatedLinks.map((l) => l.id),
                    isBulk: true,
                    entityType : "MONOLINK",
                    slice : SLICE_NAME,
                    skipSync : options?.skipSync ?? false
                })
            }),
        },
        bulkDeleteMonoLinks : {
            reducer(state, action: PayloadAction<string[]>) {
                monoLinkAdapter.removeMany(state, action);
            },
            prepare(ids : string[], options? : IOptions) {
                return {
                    payload: ids,
                    meta : buildMonolinkSyncMeta({
                        operation: 'DELETE',
                        entityIds : ids,
                        isBulk: true,
                        entityType : "MONOLINK",
                        slice : SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    })
                }
            },
        },
        clearMonoLinks(state) {
            monoLinkAdapter.removeAll(state);
        }
    }
})

export const {
    addMonoLink,
    hydrateMonoLinks,
    updateMonoLink,
    bulkDeleteMonoLinks,
    bulkUpdateMonoLinks,
    bulkAddMonoLinks,
    clearMonoLinks,
    deleteMonoLink,
} = monoLinkSlice.actions;

export const {
    selectAll: selectAllMonoLinks,
    selectById: selectMonoLinkById,
    selectTotal: selectTotalMonoLinks,
} = monoLinkAdapter.getSelectors((state: RootState) => state.monoLinksSlice);

export default monoLinkSlice.reducer;