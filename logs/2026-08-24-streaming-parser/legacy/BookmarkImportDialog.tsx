"use client";

import { useBookmarkImport } from "./hooks/useBookmarkImport";
import { Box, Container, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/shadcn/dialog";
import { BsBrowserChrome } from "react-icons/bs";
import { ConditionalRender } from "@/components/custom/ConditionalRender";
import { Button } from "@/components/ui/shadcn/button";
import { Spinner } from "@/components/ui/shadcn/spinner";
import { BookmarkSectionMonolinksCard } from "./components/bookmark-section-monolinks-card";

export const BookmarkImportDialog = () => {
    const {
        handleDispatch,
        handleImportBookmarks,
        isLoading,
        openBookmarksImportDialog,
        sections,
        setOpenBookmarksImportDialog,
    } = useBookmarkImport();

    return (
        <Dialog open={openBookmarksImportDialog} onOpenChange={(v) => setOpenBookmarksImportDialog(v)}>
            <DialogContent className="!outline-none !rounded-2xl w-xl max-h-[95%] overflow-y-scroll dark-scrollbar">
                <DialogTitle>Bookmark Import Manager</DialogTitle>
                <DialogDescription>Choose the bookmarks you’d like to import.</DialogDescription>

                <Container className="w-full space-y-4 overflow-hidden">
                    <Box onClick={handleImportBookmarks} className="w-full py-2 px-2 bg-button-brand cursor-pointer rounded-lg flex items-center justify-center">
                        <BsBrowserChrome className="mr-2" /> Import Browser Bookmark
                    </Box>

                    {/* BOTTLENECK: Heavy UI Re-renders */}
                    {/* Rendering hundreds of nested checkable components forces complete tree re-renders on any single selection toggle */}
                    <BookmarkSectionMonolinksCard sections={sections} />
                </Container>

                <ConditionalRender renderIf={sections.length > 0}>
                    <DialogFooter className="flex flex-row w-full">
                        <Button onClick={() => handleDispatch()} disabled={isLoading} className="w-full">
                            {isLoading && <Spinner />}
                            {isLoading ? "Importing..." : "Import"}
                        </Button>
                    </DialogFooter>
                </ConditionalRender>
            </DialogContent>
        </Dialog>
    );
};