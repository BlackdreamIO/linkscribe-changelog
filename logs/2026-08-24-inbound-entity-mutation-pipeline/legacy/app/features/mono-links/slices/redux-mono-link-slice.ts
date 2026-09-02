// ORIGINAL LOCATION : APP/LIB/SYSTEM/REGISTERS/MONO-LINKS/

import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { ICreateMonoLink, IMonoLink } from '@/interface/MonoLink';

import AppEvents, { APP_EVENTS } from '@/lib/system/eventBus/AppEventBus';
import { normalizeMonoLink } from '@/helpers/normalizeMonoLink';

export interface IMonoLinksState {
    monoLinks : IMonoLink[];
    isEmpty : boolean;
    loading: boolean;
    error: string | null;
}

const initialState : IMonoLinksState = {
    monoLinks : [],
    isEmpty : false,
    loading: false,
    error: null,
}

interface IExtendedMonoLink extends IMonoLink {
    _skipEventPublish? : boolean
}

const publishEvent = <T>(event: string, payload: T) => AppEvents.emit<T>(event, payload);

const monoLinkSlice = createSlice({
    name: 'monoLinkSlice',
    initialState,
    reducers: {
        hydrateMonoLinks(state, action: PayloadAction<IMonoLink[]>) {
            state.monoLinks = action.payload;
        },
        addMonoLink(state, action: PayloadAction<IExtendedMonoLink>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            state.monoLinks.push(action.payload);
            if(skipSync == false) publishEvent<IMonoLink>(APP_EVENTS.API.MONOLINKS.CREATE, action.payload);
        },
        updateMonoLink(state, action: PayloadAction<IExtendedMonoLink>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            const monoLink = state.monoLinks.find((s) => s.id === action.payload.id);
            const updatedPayload = {...action.payload, id : action.payload.id} as IMonoLink;

            if (monoLink) {
                const index = state.monoLinks.findIndex(link => link.id === action.payload.id);
                if (index !== -1) {
                    state.monoLinks[index] = { ...state.monoLinks[index], ...action.payload };
                }
            }

            if(skipSync == false) publishEvent<IMonoLink>(APP_EVENTS.API.MONOLINKS.UPDATE, updatedPayload);
        },
        removeMonoLink(state, action: PayloadAction<{id : string, _skipEventPublish? : boolean }>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            state.monoLinks = state.monoLinks.filter((s) => s.id !== action.payload.id);
            if(skipSync == false) publishEvent<string>(APP_EVENTS.API.MONOLINKS.DELETE, action.payload.id);
        },
        bulkAddMonoLinks (state, action: PayloadAction<{ monoLinks : ICreateMonoLink[] | IMonoLink[], _skipEventPublish? : boolean }>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;
            const filteredMonoLinks = action.payload.monoLinks.filter((monoLink, index, array) => array.findIndex(m => m.id === monoLink.id) === index);
            
            const normalized = filteredMonoLinks.map(normalizeMonoLink);
            
            state.monoLinks.push(...normalized);
            
            if(skipSync == false) publishEvent<IMonoLink[]>(APP_EVENTS.API.MONOLINKS.BULK_CREATE, normalized);
        },
        bulkDeleteMonoLinks(state, action: PayloadAction<string[]>) {
            state.monoLinks = state.monoLinks.filter((s) => !action.payload.includes(s.id));
            publishEvent<string[]>(APP_EVENTS.API.MONOLINKS.BULK_DELETE, action.payload);
        },
        bulkUpdateMonoLinks(state, action: PayloadAction<{ monoLinks : (Partial<IMonoLink>)[], _skipEventPublish? : boolean }>) {
            const skipSync = action.payload?._skipEventPublish == undefined ? false : action.payload._skipEventPublish;

            const incoming = action.payload.monoLinks.filter((monoLink, index, array) => monoLink.id && array.findIndex(m => m.id === monoLink.id) === index);

            incoming.forEach(update => {
                if (!update.id) return;

                const index = state.monoLinks.findIndex(m => m.id === update.id);
                if (index !== -1) {
                    state.monoLinks[index] = {
                        ...state.monoLinks[index]!,
                        ...update
                    }
                }
            })
            
            if(skipSync == false) publishEvent<IMonoLink[]>(APP_EVENTS.API.MONOLINKS.BULK_UPDATE, incoming as any[]); // incompleted
        },
        clearMonoLinks(state) {
            state.monoLinks = [];
            state.isEmpty = true;
        }
    }
})

export const { addMonoLink, removeMonoLink, hydrateMonoLinks, updateMonoLink, bulkDeleteMonoLinks, bulkUpdateMonoLinks, bulkAddMonoLinks, clearMonoLinks } = monoLinkSlice.actions;
export default monoLinkSlice.reducer;
