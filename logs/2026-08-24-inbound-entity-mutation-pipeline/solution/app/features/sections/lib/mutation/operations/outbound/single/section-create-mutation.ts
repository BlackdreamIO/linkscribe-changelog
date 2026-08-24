import { ISection } from "@/interface/Section";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { SectionsRepo } from "@/lib/database/dexie-primary/repos/SectionRepo";
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";

const dexieInstance = new DexieDB();
const sectionsRepo = new SectionsRepo(dexieInstance);

const E = APP_EVENTS.API["SECTIONS"];

export async function applySectionCreateMutation(section : ISection) {
    if(section.syncStatus == "synced") return;

    const modifiedSection = {
        ...section,
        syncStatus : "pending_create",
        updatedAt : new Date().toISOString(),
        createdAt : new Date().toISOString(),
        isDirty : false,
        _revision : 0,
    } as ISection;

    await sectionsRepo.sections.add(modifiedSection);

    //AppEvents.emit(E["INTERNAL_CHANGE"], { action : "CREATE", payload : [modifiedSection] });
}