"use client"

import { useEffect, useState } from "react";
import { useSearchParams } from 'next/navigation';
import { useBookmarkImport } from "./hooks/useBookmarkImport";

import { Box, Container, Group, Heading, HStack, ShortDescription, Text, Vertical } from "@/components/ui/lsc";
import { Checkbox } from "@/components/ui/shadcn/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogClose } from "@/components/ui/shadcn/dialog";
import { BsBrowserChrome } from "react-icons/bs";
import { FaFileAlt } from "react-icons/fa";;
import { ConditionalRender } from "@/components/custom/ConditionalRender";
import { Input } from "@/components/ui/shadcn/input";
import { Button } from "@/components/ui/shadcn/button";
import { Separator } from "@/components/ui/shadcn/separator";
import { Spinner } from "@/components/ui/shadcn/spinner";
import { BookmarkSectionMonolinksCard } from "./components/bookmark-section-monolinks-card";

export const BookmarkImportDialog = () => {

    const [shareCode, setShareCode] = useState('');
    const searchParams = useSearchParams();

    const openBookmark = searchParams.get('ob');
    const shareIdQuery = searchParams.get('shareId');

    const {
        handleDispatch,
        handleImportBookmarks,
        isLoading,
        openBookmarksImportDialog,
        sections,
        setOpenBookmarksImportDialog,
        toggleItem,
        toggleSection,
        handleImportFromShareCode,
        handleClear,
        usageStatus
    } = useBookmarkImport();

    useEffect(() => {
        if (shareIdQuery) {
            setShareCode(shareIdQuery);
        }
        if(openBookmark && openBookmark === "true") {
            setOpenBookmarksImportDialog(true);
        }
    }, [shareIdQuery, openBookmark])

    const handleClearSearchParams = () => {
        const params = new URLSearchParams(window.location.search);
        params.delete('shareId');
        params.delete('ob');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    return (
        <Dialog open={openBookmarksImportDialog} onOpenChange={(v) => {
            if(!v) handleClearSearchParams();
            if(!isLoading) {
                setOpenBookmarksImportDialog(v);
                handleClear();
            }
        }}>
            <DialogContent className="!outline-none !rounded-2xl w-xl max-h-[95%] overflow-y-scroll dark-scrollbar">
                <DialogTitle>Bookmark Import Manager</DialogTitle>
                <DialogDescription className="space-y-2">Choose the bookmarks you’d like to import.</DialogDescription>

                <Container className="w-full space-y-4 overflow-hidden">

                    <Group className="space-y-2">
                        
                        <HStack className="justify-between w-full space-x-0 py-1">
                            <Input
                                value={shareCode}
                                onChange={(e) => setShareCode(e.target.value)}
                                className="w-full"
                                placeholder="Import From Share Code"
                            />
                            <Button disabled={isLoading || shareCode.length < 3} onClick={() => handleImportFromShareCode({ shareCode, shareIdQuery, handleClearSearchParams })}>
                                { isLoading && <Spinner/> }
                                {
                                    isLoading ? "Fetching..." : "Get"
                                }
                            </Button>
                        </HStack>
                        <Separator/>
                        <HStack className="grid grid-cols-2 gap-2 ">
                            <Box onClick={handleImportBookmarks} className="w-full py-2 px-2 bg-button-brand shadow-s hover:bg-button-brand-hover hover:text-button-brand-hover-foreground transition-all duration-100 cursor-pointer  rounded-lg flex flex-col items-center justify-center">
                                <Text className="flex flex-row items-center justify-center">
                                    <BsBrowserChrome className="mr-2" /> Import Browser Bookmark
                                </Text>
                            </Box>
                            <Box className="w-full py-2 px-2 bg-button-brand shadow-s hover:bg-button-brand-hover hover:text-button-brand-hover-foreground transition-all duration-100 cursor-pointer  rounded-lg flex flex-col items-center justify-center">
                                <Text className="flex flex-row items-center justify-center"><FaFileAlt className="mr-2" /> Select Cloud (Google Drive)</Text>
                            </Box>
                        </HStack>
                        {/* <Separator/> */}
                    </Group>

                    <BookmarkSectionMonolinksCard
                        sections={sections}
                        toggleItem={toggleItem}
                        toggleSection={toggleSection}
                    />

                </Container>

                <ConditionalRender renderIf={sections.length > 0}>
                    <DialogFooter className="flex flex-row w-full">
                        <DialogClose varient="submit" onClick={() => handleDispatch(shareIdQuery !== null)} disabled={isLoading} className="w-full disabled:opacity-50 disabled:pointer-events-none">
                            { isLoading && <Spinner/> }
                            {
                                isLoading ? "Importing..." : `Import ${!usageStatus.eligible ? "(Upgrade to import more)" : ""}`
                            } 
                        </DialogClose>
                    </DialogFooter>
                </ConditionalRender>
            </DialogContent>
            
        </Dialog>
    )
}