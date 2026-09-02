import { IMonoLink } from "@/interface/MonoLink";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";

const dexieInstance = new DexieDB();
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const E = APP_EVENTS.API["MONOLINKS"];

export async function applyMonoLinkCreateMutation(monoLink : IMonoLink) {
    if(monoLink.syncStatus == "synced") return;

    const modifiedMonoLink = {
        ...monoLink,
        syncStatus : "pending_create",
        updatedAt : new Date().toISOString(),
        createdAt : new Date().toISOString(),
        isDirty : false,
        _revision : 0,
    } as IMonoLink

    await monoLinksRepo.monoLinks.add(modifiedMonoLink);

    AppEvents.emit(E["INTERNAL_CHANGE"], { action : "CREATE", payload : [modifiedMonoLink] });
}