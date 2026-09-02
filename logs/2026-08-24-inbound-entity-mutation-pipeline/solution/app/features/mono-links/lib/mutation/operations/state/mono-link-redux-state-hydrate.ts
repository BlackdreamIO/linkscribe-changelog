import { IMonoLink } from "@/interface/MonoLink";
import { bulkAddMonoLinks, bulkDeleteMonoLinks, bulkUpdateMonoLinks } from "../../../../slices/redux-mono-links-slice";
import { store } from "@/redux/store";

const dispatch = store.dispatch;

export type MonoLinkReduxHydrationState = {
    add : IMonoLink[], update : IMonoLink[], deleted : string[],
}

export function applyMonoLinkReduxStateHydratoion({ add, deleted, update } : MonoLinkReduxHydrationState) {
    dispatch(bulkAddMonoLinks(add, { skipSync : true }));
    dispatch(bulkUpdateMonoLinks(update, { skipSync : true }));
    dispatch(bulkDeleteMonoLinks(deleted, { skipSync : true }));
}