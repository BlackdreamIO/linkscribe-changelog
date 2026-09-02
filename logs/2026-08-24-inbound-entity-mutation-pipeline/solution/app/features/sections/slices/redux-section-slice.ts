import { CreateSectionFromUI, ISection, UpdateSectionFromUI } from '@/interface/Section';
import { EntityState, PayloadAction, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { createSliceSyncMetaFactory } from '../helpers/createSyncMetaFactory';
import { RootState } from '../store';

export const sectionAdapter = createEntityAdapter<ISection, string>({
    selectId: (section) => section.id,
    sortComparer: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
})

export interface ISectionsState extends EntityState<ISection, string> {
    sections : ISection[];
    isEmpty : boolean;
    loading: boolean;
    error: string | null;
}

interface IOptions {
    skipSync? : boolean;
}

const initialState : ISectionsState = sectionAdapter.getInitialState({
    sections: [],
    isEmpty: true,
    loading: false,
    error: null
})

const SLICE_NAME = 'sectionsSlice';

const buildSyncMeta = createSliceSyncMetaFactory();

const sectionsSlice = createSlice({
    name: 'sectionsSlice',
    initialState,
    reducers: {
        hydrateSections(state, action: PayloadAction<ISection[]>) {
            sectionAdapter.upsertMany(state, action.payload)
        },

        addSection : {
            reducer: (state, action: PayloadAction<ISection>) => {
                sectionAdapter.addOne(state, action)
            },
            prepare: (payload: CreateSectionFromUI, options?: IOptions) => {
                const id = crypto.randomUUID();
                const now = new Date().toISOString();

                const newSection: ISection = {
                    ...payload,
                    id,
                    version: 1,
                    syncStatus: 'pending_create',
                    isDirty: false,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now,
                    layout : { alphabetical : false, columns : 1, groups : false, mode : "List" },
                    tags : []
                };
                
                return {
                    payload : newSection,
                    meta : buildSyncMeta({
                        operation: 'CREATE',
                        entityId: newSection.id,
                        isBulk: false,
                        entityType : "SECTION",
                        slice : SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    })
                }
            },
        },
        updateSection: {
            reducer: (state, action: PayloadAction<{ id: string; changes: Partial<ISection> }>) => {
                sectionAdapter.updateOne(state, action);
            },
            prepare: (payload: UpdateSectionFromUI, options? : IOptions) => ({
                payload: {
                    id: payload.id,
                    changes: {
                        ...payload,
                        isDirty: true,
                        updatedAt: new Date().toISOString(),
                    } as Partial<ISection>,
                },
                meta : buildSyncMeta({
                    operation: 'UPDATE',
                    entityId: payload.id,
                    isBulk: false,
                    entityType : "SECTION",
                    slice : SLICE_NAME,
                    skipSync : options?.skipSync ?? false
                })
            }),
        },
        deleteSection : {
            reducer(state, action: PayloadAction<string>) {
                sectionAdapter.removeOne(state, action);
            },
            prepare(id : string, options? : IOptions) {
                return {
                    payload: id,
                    meta : buildSyncMeta({
                        operation: 'DELETE',
                        entityId: id,
                        isBulk: false,
                        entityType : "SECTION",
                        slice : SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    })
                }
            },
        },
        // ------------------ BULK ---------------------//
        bulkAddSections: {
            reducer: (state, action: PayloadAction<ISection[]>) => {
                sectionAdapter.addMany(state, action);
            },
            prepare: (payloads: CreateSectionFromUI[], options? : IOptions) => {
                const now = new Date().toISOString();
                const newSections: ISection[] = payloads.map((payload) => {
                    if ('id' in payload && payload.id) {
                        return payload as ISection;
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
                        layout : { alphabetical : false, columns : 1, groups : false, mode : "List" },
                        tags : []
                    };
                });

                return {
                    payload: newSections,
                    meta: buildSyncMeta({
                        operation: 'CREATE',
                        entityIds: newSections.map((item) => item.id),
                        isBulk: true,
                        entityType: 'SECTION',
                        slice: SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    }),
                };
            },
        },
        bulkUpdateSections : {
            reducer: (state, action: PayloadAction<{ id: string; changes: Partial<ISection> }[]>) => {
                sectionAdapter.updateMany(state, action);
            },
            prepare: (updatedSections: UpdateSectionFromUI[], options? : IOptions) => ({
                payload: updatedSections.map(section => ({
                    id: section.id,
                    changes: {
                        ...section,
                        isDirty: true,
                        updatedAt: new Date().toISOString(),
                    } as Partial<ISection>,
                })),
                meta : buildSyncMeta({
                    operation: 'UPDATE',
                    entityIds: updatedSections.map((l) => l.id),
                    isBulk: true,
                    entityType : "SECTION",
                    slice : SLICE_NAME,
                    skipSync : options?.skipSync ?? false
                })
            }),
        },
        bulkDeleteSections : {
            reducer(state, action: PayloadAction<string[]>) {
                sectionAdapter.removeMany(state, action);
            },
            prepare(ids : string[], options? : IOptions) {
                return {
                    payload: ids,
                    meta : buildSyncMeta({
                        operation: 'DELETE',
                        entityIds : ids,
                        isBulk: true,
                        entityType : "SECTION",
                        slice : SLICE_NAME,
                        skipSync : options?.skipSync ?? false
                    })
                }
            },
        },
        clearSections(state) {
            sectionAdapter.removeAll(state)
        }
    }
});

export const {
    addSection,
    updateSection,
    deleteSection,
    hydrateSections,
    bulkUpdateSections,
    bulkDeleteSections,
    bulkAddSections,
    clearSections
} = sectionsSlice.actions;

export const {
    selectAll: selectAllSections,
    selectById: selectSectionById,
    selectTotal: selectTotalSections,
} = sectionAdapter.getSelectors((state: RootState) => state.sectionsSlice);

export default sectionsSlice.reducer;
