"use client";

import { useState, useEffect } from "react";
import * as Comlink from "comlink";
import { useAppDispatch } from "@/redux/hooks";
import { bulkAddSections } from "@/redux/feature/redux-section-slice";
import { bulkAddMonoLinks } from "@/app/features/mono-links/slices/redux-mono-links-slice";

export function useBookmarkImport() {
    const [sections, setSections] = useState<any[]>([]);
    const dispatch = useAppDispatch();

    const checkValidity = async () => {
        const totalMonoLinksCount = sections.flatMap(s => s.monoLinks.filter((m: any) => m.checked)).length;
        // Queries SubscriptionRepo with section/link counts and sets usage eligibility state.
    };

    useEffect(() => {
        checkValidity();
    }, [sections]);

    const handleImportBookmarks = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".html";

        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const text = await file.text();
            
            const worker = new Worker(new URL("@/workers/mono-links/MonoLink.worker", import.meta.url));
            const api = Comlink.wrap<any>(worker);

            const { sectionList, linkList } = await api.parseBookmarks(text, "user_id");

            const constructedSection = sectionList.map((s: any) => ({
                ...s,
                checked: true,
                monoLinks: linkList
                    .filter((l: any) => l.sectionId === s.id)
                    .map((l: any) => ({ ...l, checked: true })),
            }));

            // Calculates subscription validity for parsed bookmarks and updates state.
            setSections(constructedSection);
        };
        input.click();
    };

    const handleDispatch = async () => {
        const filteredSections = [...new Map(sections.map((s) => [s.id, s])).values()];
        const filteredMonoLinks = [...new Map(sections.flatMap((s) => s.monoLinks).map((item) => [item.url, item])).values()];

        const worker = new Worker(new URL("@/workers/mono-links/MonoLink.worker", import.meta.url));
        const api = Comlink.wrap<any>(worker);
        const response = await api.checkLocalConflictAgainstPayload(filteredMonoLinks);

        if (response.data.hasConflicts) {
            // Emits sync conflict events and notifies UI before halting execution.
            return;
        }

        worker.terminate();

        dispatch(bulkAddSections({ sections: filteredSections, _skipEventPublish: false }));
        
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        dispatch(bulkAddMonoLinks({ monoLinks: filteredMonoLinks, _skipEventPublish: false }));
        // Tracks analytics events and closes the import dialog.
    };

    return { handleImportBookmarks, handleDispatch };
}