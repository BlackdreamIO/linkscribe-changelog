import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { assoc, mergeRight } from "ramda";
import { store } from "@/redux/store";
import { updateMonoLink, deleteMonoLink, bulkDeleteMonoLinks, bulkAddMonoLinks, bulkUpdateMonoLinks } from "@/app/features/mono-links/slices/redux-mono-links-slice";
import { IMonoLink } from "@/interface/MonoLink";
import { equalsWithoutProperties } from "@/helpers/compareObjectWithExclusion";
import { SubscriptionRepo } from "@/lib/database/dexie-primary/repos/SubscriptionRepo";
import { getChangedFields } from "@/helpers/getChangesBetweenObjects";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";

const dexieInstance = new DexieDB();
const subscriptionRepo = new SubscriptionRepo(dexieInstance);
const dispatch = store.dispatch;

const dexieMonoLinkRepo = dexieInstance.monoLinksRepo;

export async function handleBulkCreate(monoLinks: IMonoLink[]) {

    /*-------------------------------------------- Build Modified Items ---------------------------------- */

    const itemsToAdd = monoLinks.map(monoLink => {
        if(monoLink.syncStatus == "synced") return null;

        const modifiedMonoLink = mergeRight(monoLink, {
            syncStatus : "pending_create",
            updatedAt : new Date().toISOString(),
            _revision : 0
        } as IMonoLink);

        return modifiedMonoLink;
    }).filter((item): item is IMonoLink => item !== null);

    if(itemsToAdd.length === 0) return;

    /*-------------------------------------------- Subscription Usage Validity Check ---------------------------------- */

    const valid = await subscriptionRepo.checkUpdateValidity("increment", "mono_links_count", itemsToAdd.length);

    if(!valid) {
        AppEvents.emit(APP_EVENTS.API.SUBSCRIPTION.EXCEED, { message : 'Failed To Create Mono Links Due To Insufficient Credit.' });
        dispatch(bulkDeleteMonoLinks(monoLinks.map(m => m.id)));
        return;
    }

    /*-------------------------------------------- Insert MonoLinks To DexieDB ---------------------------------- */

    await dexieMonoLinkRepo.addMonoLinks({ monoLinks : itemsToAdd });

    /*-------------------------------------------- Trigger Internal Changes ---------------------------------- */

    AppEvents.emit(APP_EVENTS.API.MONOLINKS["INTERNAL_CHANGE"], { action : "CREATE", payload : itemsToAdd });
}

export async function handleCreate(monoLink: IMonoLink) {
    /*---------------------------------------Skip Creation Of Already Synced MonoLink ---------------------------------- */

    if(monoLink.syncStatus == "synced") return;

    /*-------------------------------------------- Build Modified Items ---------------------------------- */

    const modifiedMonoLink = mergeRight(monoLink, {
        syncStatus : "pending_create",
        updatedAt : new Date().toISOString(),
        _revision : 0
    } as IMonoLink);

    /*-------------------------------------------- Subscription Usage Validity Check ---------------------------------- */

    const valid = await subscriptionRepo.checkUpdateValidity("increment", "mono_links_count", 1);

    if(!valid) {
        AppEvents.emit(APP_EVENTS.API.SUBSCRIPTION.EXCEED, { message : 'Failed To Create Mono Links Due To Insufficient Credit.' });
        return;
    }

    /*-------------------------------------------- Insert Single MonoLink ---------------------------------- */

    await dexieMonoLinkRepo.addMonoLink({ monoLink : modifiedMonoLink });
    AppEvents.emit(APP_EVENTS.API.MONOLINKS.INTERNAL_CHANGE, { action : "CREATE", payload : [modifiedMonoLink] });
}

interface IExtendedMonoLink extends IMonoLink {
    _skipEventPublish? : boolean;
}

export async function handleUpdate(monoLink: IExtendedMonoLink) {
    if(!monoLink.id || monoLink.syncStatus == "sync_failed") return;

    // ----------------------------------------- GET DEXIE MONO LINK ----------------------------------------------------------------------------------
    const targetMonoLink = await dexieMonoLinkRepo.getMonoLink(monoLink.id);
    if (!targetMonoLink) return;

    // ----------------------------------------- CHECK DIFFERENCE BY EXCLUDING CERTAIN KEYS ----------------------------------------------------------------------------------
    const excludedKeys: Array<keyof IExtendedMonoLink> = ["syncStatus", "createdAt", "updatedAt"];
    if(equalsWithoutProperties(targetMonoLink, monoLink, excludedKeys)) return;

    // ----------------------------------------- GET DIFFERENCE ----------------------------------------------------------------------------------
    const difference = getChangedFields(monoLink, targetMonoLink);
    const hasChanges = Object.keys(difference).length > 0;
    if(!hasChanges) return; // RETURN ON NO DIFFERENCE

    const isPendingCreate = targetMonoLink.syncStatus == "pending_create";

    //----------------------------------------- BUILD UPDATED PAYLOAD --------------------------------------------------------
    const updatedBasePayload : (Partial<IMonoLink> & { id : string, sectionId : string, userId : string }) = {
        ...difference,
        id : targetMonoLink.id,
        sectionId : targetMonoLink.sectionId,
        userId : targetMonoLink.userId,
        isDirty : true,
        updatedAt : new Date().toISOString(),
        syncStatus : isPendingCreate ? "pending_create" : "pending_update",
        _revision : (targetMonoLink?._revision ?? 0) + 1,
        version : targetMonoLink.version,
    }

    // IF PENDING CREATE, UPDATE AND RETURN
    if(isPendingCreate) {
        const { ...restUpdated } = updatedBasePayload;

        dispatch(updateMonoLink({...updatedBasePayload, _skipEventPublish : true} as IExtendedMonoLink));
        await dexieMonoLinkRepo.updateMonoLink({ updatedMonoLink : restUpdated });

        // ----------------------------------------- TRIGGER INTERNAL CHANGE -----------------------------------------
        AppEvents.emit(APP_EVENTS.API.MONOLINKS.INTERNAL_CHANGE, {
            action : "UPDATE",
            payload : [{...getChangedFields(updatedBasePayload, targetMonoLink), id : targetMonoLink.id}]
        });

        return;
    }

    // ----------------------------------------- UPDATE AND RETURN ----------------------------------------------------------------------------------
    dispatch(updateMonoLink({...updatedBasePayload, _skipEventPublish : true} as IExtendedMonoLink));
    await dexieMonoLinkRepo.updateMonoLink({ updatedMonoLink : updatedBasePayload });

    // ----------------------------------------- TRIGGER INTERNAL CHANGE ----------------------------------------------------------------------------------
    AppEvents.emit(APP_EVENTS.API.MONOLINKS["INTERNAL_CHANGE"], {
        action : "UPDATE",
        payload : [{
            ...getChangedFields(updatedBasePayload, targetMonoLink),
            id : targetMonoLink.id,
            sectionId : targetMonoLink.sectionId,
            userId : targetMonoLink.userId,
        }]
    });
}

export async function handleDelete(id: string) {
    const targetMonoLink = await dexieMonoLinkRepo.getMonoLink(id);
    if (!targetMonoLink) return;
    
    const updatedMonoLink = assoc("syncStatus", "pending_delete", targetMonoLink) as IMonoLink;
    
    if(targetMonoLink.syncStatus == "synced" || targetMonoLink.syncStatus === "pending_update") {
        dispatch(updateMonoLink(updatedMonoLink));
        await dexieMonoLinkRepo.updateMonoLink({ updatedMonoLink });
    }
    else {
        await dexieMonoLinkRepo.deleteMonoLink({ id });
        dispatch(deleteMonoLink(id, { skipSync : true }));
        AppEvents.emit(APP_EVENTS.API.MONOLINKS.INTERNAL_CHANGE, { action : "DELETE", payload : [id] });
    }
}

export async function handleBulkDelete(monoLinkIds : string[]) {
    await dexieInstance.monoLinksRepo.bulkDelete(monoLinkIds);
    AppEvents.emit(APP_EVENTS.API.MONOLINKS.INTERNAL_CHANGE, { action : "DELETE", payload : monoLinkIds });
}

export async function handleSync(monoLink : IMonoLink) {
    if(monoLink.syncStatus == "deleted") {
        try {
            await dexieMonoLinkRepo.deleteMonoLink({ id : monoLink.id });
            dispatch(deleteMonoLink(monoLink.id, { skipSync : true }));
            return;
        }
        catch (error) {
            console.log(error)
            return;   
        }
    }

    const updatedMonoLink = assoc("syncStatus", "synced", monoLink) as IMonoLink;
    
    dispatch(updateMonoLink(updatedMonoLink, { skipSync : true }));
    await dexieMonoLinkRepo.updateMonoLink({ updatedMonoLink });
}

export async function handleSyncFailed(monoLink : IMonoLink) {
    const updatedMonoLink = assoc("syncStatus", "sync_failed", monoLink) as IMonoLink;
    
    store.dispatch(updateMonoLink(updatedMonoLink));
    await dexieMonoLinkRepo.updateMonoLink({ updatedMonoLink });
    await dexieInstance.syncQueue.update(monoLink.id, { status : "FAILED" });
}

type StateChanges = {
    add : IMonoLink[], update : IMonoLink[], deleted : string[],
}

export function handleHydrateReduxState({ add, deleted, update } : StateChanges) {
    dispatch(bulkAddMonoLinks(add, { skipSync : true }));
    dispatch(bulkUpdateMonoLinks(update, { skipSync : true }));
    dispatch(bulkDeleteMonoLinks(deleted, { skipSync : true }));
}