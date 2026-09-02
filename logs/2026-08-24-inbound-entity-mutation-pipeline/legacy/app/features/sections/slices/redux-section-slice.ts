import { ISection } from '@/interface/Section';
import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import AppEvents, { APP_EVENTS } from '@/lib/system/eventBus/AppEventBus';

export interface ISectionsState {
    sections : ISection[];
    isEmpty : boolean;
    loading: boolean;
    error: string | null;
}

const initialState : ISectionsState = {
    sections : [],
    isEmpty : false,
    loading: false,
    error: null,
};

interface IExtendedSection extends ISection {
    _skipEventPublish? : boolean;
}

const publishEvent = <T>(type : string, payload : T) => AppEvents.emit<T>(type, payload);

const sectionsSlice = createSlice({
    name: 'sectionsSlice',
    initialState,
    reducers: {
        hydrateSections(state, action: PayloadAction<ISection[]>) {
            state.sections = action.payload;
        },
        addSection(state, action: PayloadAction<IExtendedSection>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            state.sections.push({...action.payload, syncStatus : action.payload?.syncStatus ??  "pending_create"});
            if(skipSync == false) publishEvent(APP_EVENTS.API.SECTIONS.CREATE, action.payload);
        },
        bulkAddSections(state, action: PayloadAction<{ sections : ISection[], _skipEventPublish? : boolean }>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            state.sections.push(...action.payload.sections);
            for (const section of action.payload.sections) {
                if(skipSync == false) publishEvent(APP_EVENTS.API.SECTIONS.CREATE, section);
            }
        },
        updateSection(state, action: PayloadAction<IExtendedSection>) {
            
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            const section = state.sections.find((s) => s.id === action.payload.id);
            
            if (section) Object.assign(section, action.payload);
            if(!skipSync) publishEvent(APP_EVENTS.API.SECTIONS.UPDATE, action.payload);
        },
        bulkUpdateSections(state, action: PayloadAction<{ sections : (Partial<ISection>)[], _skipEventPublish? : boolean }>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            
            const incoming = action.payload.sections.filter((section, index, array) => section.id && array.findIndex(m => m.id === section.id) === index);
            
            incoming.forEach(update => {
                if (!update.id) return;

                const index = state.sections.findIndex(s => s.id === update.id);
                if (index !== -1) {
                    state.sections[index] = {
                        ...state.sections[index]!,
                        ...update
                    }
                }
            })

            if(skipSync == false) publishEvent<ISection[]>(APP_EVENTS.API.SECTIONS.BULK_UPDATE, incoming as any[]); // incompleted
        },
        bulkDeleteSections(state, action: PayloadAction<string[]>) {
            state.sections = state.sections.filter((s) => !action.payload.includes(s.id));
            publishEvent<string[]>(APP_EVENTS.API.SECTIONS.BULK_DELETE, action.payload);
        },
        removeSection(state, action: PayloadAction<{ id : string } & { _skipEventPublish? : boolean }>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            state.sections = state.sections.filter((s) => s.id !== action.payload.id);
            if(skipSync == false) publishEvent<string>(APP_EVENTS.API.SECTIONS.DELETE, action.payload.id);
        },
        clearSections(state) {
            state.sections = [];
            state.isEmpty = true;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(reHydrateSections.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(reHydrateSections.fulfilled, (state, action: PayloadAction<ISection[] | null>) => {
                if (action.payload) {
                    state.sections = action.payload;
                    state.isEmpty = action.payload.length === 0;
                }
                else {
                    state.sections = [];
                    state.isEmpty = true;
                }
                state.loading = false;
            })
    },
});

export const { addSection, removeSection, hydrateSections, updateSection, bulkUpdateSections, bulkDeleteSections, bulkAddSections, clearSections } = sectionsSlice.actions;
export default sectionsSlice.reducer;
