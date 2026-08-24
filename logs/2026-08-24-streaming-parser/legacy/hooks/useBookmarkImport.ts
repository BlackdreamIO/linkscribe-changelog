"use client"

import { getSectionByShareCode } from "@/actions/shares/getSectionByShareCode";
import { bulkAddMonoLinks } from "@/app/features/mono-links/slices/redux-mono-links-slice";
import { DexieDB } from "@/lib/database/dexie-primary/Dexie";
import { useGlobalSectionContext } from "@/context/SectionContextProvider";
import { convertSupabaseMonoLinkToAppMonoLink, convertSupabaseSectionToAppSection } from "@/helpers/convertion";
import { infoToast } from "@/hooks/useReactTostify";
import { IMonoLink } from "@/interface/MonoLink";
import { ISection } from "@/interface/Section";
import { API_STATUS } from "@/lib/api/apiStatus";
import { SubscriptionRepo } from "@/lib/database/dexie-primary/repos/SubscriptionRepo";
import { DOCUMENT_DISPATCH_EVENTS } from "@/lib/system/dispatcher/dispatch-events";
import { dispatchDocumentEvent } from "@/lib/system/dispatcher/document-dispatch";
import { bulkAddSections } from "@/redux/feature/redux-section-slice";
import { useAppDispatch } from "@/redux/hooks";
import { RootState } from "@/redux/store";
import { MonoLinkWorkerAPI } from "@/workers/mono-links/MonoLink.worker";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import * as Comlink from 'comlink';
import AppEvents, { APP_EVENTS } from "@/lib/system/eventBus/AppEventBus";

const dexieInstance = new DexieDB();
const subscriptionRepo = new SubscriptionRepo(dexieInstance);

interface IBookmarkMonoLink extends IMonoLink {
    checked : boolean;
}

interface IBookmarkSection extends ISection {
    monoLinks : IBookmarkMonoLink[];
    checked : boolean;
}

export function useBookmarkImport () {
    const [sections, setSections] = useState<IBookmarkSection[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [usageStatus, setUsageStatus] = useState({
        eligible : true,
        message : "",
        monoLinksLimitExceeded : false,
        sectionsLimitExceeded : false
    });

    const { user } = useUser();
    const dispatch = useAppDispatch();

    const { openBookmarksImportDialog, setOpenBookmarksImportDialog } = useGlobalSectionContext();

    const checkValidity = async () => {
        const existingUsage = await subscriptionRepo.getUsage();

        if(!existingUsage) return;
        if(!user?.id) return;

        const totalMonoLinksCount = sections.flatMap(s => s.monoLinks.filter(m => m.checked === true)).length;
        const totalSectionsCount = sections.filter(s => s.checked === true).length;

        const isEligibleForMonoLinks = await subscriptionRepo.checkUpdateValidity("increment", "mono_links_count", totalMonoLinksCount);
        const isEligibleForSections = await subscriptionRepo.checkUpdateValidity("increment", "sections_count", totalSectionsCount);

        setUsageStatus({
            eligible : isEligibleForMonoLinks===true && isEligibleForSections===true,
            message : isEligibleForMonoLinks && isEligibleForSections ? "Success" : "Subscription Limit Exceeded",
            monoLinksLimitExceeded : isEligibleForMonoLinks,
            sectionsLimitExceeded : isEligibleForSections
        })
    }

    useEffect(() => {
        checkValidity();
    }, [sections])
    
    const toggleSection =  async (sectionIndex: number) => {
        setSections(prev => {
            const copy = prev.map(s => ({ ...s, monoLinks: s.monoLinks.map(it => ({ ...it })) }));
            const section = copy[sectionIndex];
            if (!section) return prev;
            section.checked = !section.checked;
            section.monoLinks = section.monoLinks.map(it => ({ ...it, checked: section.checked }));
            return copy;
        })

        await checkValidity();
    }

    const toggleItem = async (sectionIndex: number, itemIndex: number) => {
        setSections(prev => {
            const copy = prev.map(s => ({ ...s, monoLinks: s.monoLinks.map(it => ({ ...it })) }));
            const section = copy[sectionIndex];
            if (!section) return prev;

                if(!section.monoLinks[itemIndex]) return prev;

                section.monoLinks[itemIndex]!.checked = !section.monoLinks[itemIndex]!.checked;
                section.checked = section.monoLinks.every(it => it.checked);
                return copy;
            }
        )

        await checkValidity();
    }

    const handleDispatch = async (importedViaShareCode? : boolean) => {

        if(!user) {
            alert(`Due Authentication Error Your Bookmark Couldn't Import Please ReLogin.`)
            return;
        }

        if(!usageStatus.eligible) {
            setOpenBookmarksImportDialog(false);
            dispatchDocumentEvent(DOCUMENT_DISPATCH_EVENTS.SUBSCRIPTION_DIALOGS.OPEN_SUBSCRIPTION_LIMIT_EXCEED_DIALOG, { message : usageStatus.message });
            return;
        }

        setIsLoading(true);

        const filteredSections = [
            ...new Map(
                sections.filter((s) => s.monoLinks.some((ml) => ml.checked)).map(({ checked, monoLinks, ...rest }) => [rest.id, rest as ISection])
            )
            .values()
        ]

        const filteredMonoLinks = [
            ...new Map(
                sections
                .flatMap((s) =>
                    s.monoLinks
                    .filter((ml) => ml.checked)
                    .map(({ checked, ...rest }) => ({
                        ...rest,
                        userId: user.id,
                    }))
                )
                .map((item) => [item.url, item])
            ).values(),
        ]

        
        const worker = new Worker(new URL('@/workers/mono-links/MonoLink.worker', import.meta.url));
        const api = Comlink.wrap<MonoLinkWorkerAPI>(worker);

        const response = await api.checkLocalConflictAgainstPayload(filteredMonoLinks);

        if(response.data.hasConflicts) {
            infoToast({
                title : 'Conflict Found',
                origin : 'SYNC_ENGINE',
                type : 'warning',
            })

            AppEvents.emit(APP_EVENTS.API.APP_SYNC_ENGINE.CONFLICT, {
                count: response.data.conflictedIds.length,
                conflicts : response.data.conflictedIds.map(cid => cid.original)
            });

            return;
        }

        worker.terminate();

        dispatch(bulkAddSections({ sections : filteredSections, _skipEventPublish : false }));
        await new Promise(resolve => setTimeout(resolve, 500));
        dispatch(bulkAddMonoLinks({ monoLinks : filteredMonoLinks, _skipEventPublish : false }));

        posthog.capture("bookmarks_imported", {
            section_count : filteredSections.length,
            monolink_count : filteredMonoLinks.length,
            is_shared : importedViaShareCode ?? false,
            method : "bookmark_importer_dialog"
        });

        setOpenBookmarksImportDialog(false);
        setIsLoading(false);
    }

    const handleImportBookmarks = () => {
    
        if(!user || !user.primaryEmailAddress?.emailAddress) {
            return;
        }
    
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html';
       
        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const text = await file.text();
            
            const worker = new Worker(new URL('@/workers/mono-links/MonoLink.worker', import.meta.url));
            const api = Comlink.wrap<MonoLinkWorkerAPI>(worker);

            const { sectionList, linkList } = await api.parseBookmarks(text, user.id);

            console.log({
                sectionList, linkList
            })

            const constructedSection = sectionList.map((s, i) => ({ ...s, checked : true, monoLinks : linkList.filter(l => l.sectionId === s.id).map((l, j) => ({ ...l, checked : true })) }));

            const totalMonoLinksCount = linkList.length;
            const totalSectionsCount = sectionList.length;

            const isEligibleForMonoLinks = await subscriptionRepo.checkUpdateValidity("increment", "mono_links_count", totalMonoLinksCount);
            const isEligibleForSections = await subscriptionRepo.checkUpdateValidity("increment", "sections_count", totalSectionsCount);

            setSections(constructedSection);

            if(!isEligibleForMonoLinks || !isEligibleForSections) {
                setUsageStatus({
                    eligible : false,
                    message : "Subscription Limit Exceeded",
                    monoLinksLimitExceeded : isEligibleForMonoLinks,
                    sectionsLimitExceeded : isEligibleForSections
                })
                return;
            }

            setUsageStatus({
                eligible : true,
                message : "Eligible",
                monoLinksLimitExceeded : isEligibleForMonoLinks,
                sectionsLimitExceeded : isEligibleForSections
            })
        };
        input.click();
    }

    const handleImportFromShareCode = async ({ shareIdQuery, shareCode, handleClearSearchParams } : { shareIdQuery : string | null, shareCode : string, handleClearSearchParams : () => void }) => {
        if(shareIdQuery || shareCode.length > 0) {
    
            setIsLoading(true);
    
            const shareId = shareIdQuery ?? shareCode;
            const { success, status, data, message } = await getSectionByShareCode(shareId);
    
            if(success && status === 200) {
                if(data?.section) {
    
                    const sectionId = crypto.randomUUID();
    
                    setSections([{
                        ...convertSupabaseSectionToAppSection({...data.section, id : sectionId}),
                        monoLinks : data.monoLinks.map(m => ({
                            ...convertSupabaseMonoLinkToAppMonoLink({...m, sync_status : "pending_create", id : crypto.randomUUID(), section_id : sectionId}),
                            checked : true
                        })),
                        checked : true
                    }]);
    
                    handleClearSearchParams();
                }
                setIsLoading(false);
                return;
            }
            else {
                setIsLoading(false);
                if(status === API_STATUS.NOT_FOUND) {
                    infoToast({
                        title : "Content Not Found",
                        origin : "SERVER",
                        type : "error",
                        description : `The requested content could not be found. Please verify the share code and try again.`
                    })
                    return;    
                }
                else if(status === API_STATUS.UNAUTHORIZED) {
                    infoToast({
                        title : "Access Denied",
                        origin : "SERVER",
                        type : "warning",
                        description : `You do not have the required permissions to access this content`
                    })
                    return;    
                }
                else if(status === API_STATUS.INTERNAL_SERVER_ERROR) {
                    infoToast({
                        title : "Internal Server Error",
                        origin : "SERVER",
                        type : "error",
                        description : `An unexpected error occurred on the server. Please try again later or contact support if the issue persists.`
                    })
                    return;    
                }
                else {
                    infoToast({
                        title : message,
                        origin : "SERVER",
                        type : "error",
                        description : `An unexpected error occurred on the server. Please try again later or contact support if the issue persists.`
                    })
                    return;  
                }
            }
        }
    }

    const handleClear = () => {
        setSections([]);
        setIsLoading(false);
    }

    return {
        sections,
        isLoading,
        openBookmarksImportDialog,
        setOpenBookmarksImportDialog,
        toggleSection,
        toggleItem,
        handleDispatch,
        handleImportBookmarks,
        setSections,
        setIsLoading,
        handleImportFromShareCode,
        handleClear,
        usageStatus
    }
}