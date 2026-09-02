import { ISection } from "@/interface/Section";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { SectionsRepo } from "@/lib/database/dexie-primary/repos/SectionRepo";

const dexieInstance = new DexieDB();
const sectionsRepo = new SectionsRepo(dexieInstance);


export async function applySectionBulkCreateMutation(sections : ISection[]) {
    await sectionsRepo.sections.bulkAdd(sections);
}