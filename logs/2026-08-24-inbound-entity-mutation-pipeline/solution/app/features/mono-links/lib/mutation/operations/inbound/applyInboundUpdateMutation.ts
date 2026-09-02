import { IMonoLink } from "@/interface/MonoLink";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import { store } from "@/redux/store";
import { bulkUpdateMonoLinks } from "../../../../slices/redux-mono-links-slice";

const dexieInstance = new DexieDB();
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

const dispatch = store.dispatch;

export async function applyInboundMonoLinkUpdateMutation(updates: Array<{ id: string; changes: Partial<IMonoLink> }>) {
    if (updates.length === 0) return;

    const reduxUpdates : { id : string, changes : Partial<IMonoLink> }[] = [];

    await dexieInstance.transaction('rw', monoLinksRepo.monoLinks, async () => {
        const updatedPayloads : { key : string, changes : Partial<IMonoLink> }[] = []

        for (const { id, changes } of updates) {
            updatedPayloads.push({
                key: id,
                changes: {
                    ...changes,
                    isDirty: false,
                    syncStatus: "synced",
                }
            })
            reduxUpdates.push({ id, changes: { ...changes, isDirty : false, syncStatus : "synced" } });
        }

        await monoLinksRepo.monoLinks.bulkUpdate(updatedPayloads);
    })

    dispatch(bulkUpdateMonoLinks(reduxUpdates, { skipSync: true }));
}