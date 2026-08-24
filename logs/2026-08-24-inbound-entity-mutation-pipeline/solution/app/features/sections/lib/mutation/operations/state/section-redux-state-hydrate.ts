import { ISection } from "@/interface/Section";
import { bulkAddSections, bulkDeleteSections, bulkUpdateSections } from "@/redux/feature/redux-section-slice";
import { store } from "@/redux/store";

const dispatch = store.dispatch;

export type SectionReduxHydrationState = {
    add : ISection[], update : ISection[], deleted : string[],
}

export function applySectionReduxStateHydratoion({ add, deleted, update } : SectionReduxHydrationState) {
    if(add.length > 0) dispatch(bulkAddSections(add, { skipSync : true }));
    if(update.length > 0) dispatch(bulkUpdateSections(update, { skipSync : true }));
    if(deleted.length > 0) dispatch(bulkDeleteSections(deleted, { skipSync : true }));
}