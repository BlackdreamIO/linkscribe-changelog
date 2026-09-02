import { IMonoLink, LinkFeatures } from "@/interface/MonoLink";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { MonoLinksRepo } from "@/lib/database/dexie-primary/repos/MonoLinkRepo";
import { store } from "@/redux/store";
import { bulkUpdateMonoLinks } from "../../../../slices/redux-mono-links-slice";

const dexieInstance = new DexieDB();
const monoLinksRepo = new MonoLinksRepo(dexieInstance);

export type FeaturePatchItem = {
    id: string;
    features: Partial<LinkFeatures>;
}

export async function applyInboundFeaturePatchMutation(patches: FeaturePatchItem[]) {
    if (patches.length === 0) return;

    const reduxUpdates: Array<{ id: string; changes: Partial<IMonoLink> }> = [];

    await dexieInstance.transaction("rw", [monoLinksRepo.monoLinks.name], async () => {
        for (const { id, features } of patches) {
            const existing = await monoLinksRepo.monoLinks.get(id);
            if (!existing) continue;

            const mergedFeatures: LinkFeatures = {
                ...(existing.features || {}),
                ...features,
            }

            const changes: Partial<IMonoLink> = {
                features: mergedFeatures,
                isDirty: false,
                syncStatus: "synced",
            }

            await monoLinksRepo.monoLinks.update(id, changes);
            reduxUpdates.push({ id, changes });
        }
    })

    if (reduxUpdates.length > 0) {
        store.dispatch(bulkUpdateMonoLinks(reduxUpdates, { skipSync: true }));
    }
}