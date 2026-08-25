"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Box, HStack, Text, Vertical } from "@/components/ui/lsc";
import { Checkbox } from "@/components/ui/shadcn/checkbox";
import { ConditionalRender } from "@/components/custom/ConditionalRender";
import { Bookmark } from "lucide-react";

type VirtualizedMonoLinksProps = {
    monoLinks: any[];
    sectionIndex: number;
    toggleItem?: (sectionIndex: number, itemIndex: number) => void;
};

const VirtualizedMonoLinks = ({ monoLinks, sectionIndex, toggleItem }: VirtualizedMonoLinksProps) => {
    const parentRef = useRef<HTMLDivElement | null>(null);

    // INTENT: Virtualize large bookmark lists to reduce DOM node counts and preserve UI smooth scrolling.
    // BOTTLENECK: Nested scroll containers (inner list virtualizer inside parent overflow container)
    // cause scroll chaining, layout calculations thrashing, and erratic height estimations.
    const rowVirtualizer = useVirtualizer({
        count: monoLinks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
        overscan: 5
    });

    return (
        <div ref={parentRef} className="max-h-[900px] overflow-y-auto dark-scrollbar">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const monoLink = monoLinks[virtualRow.index];
                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: virtualRow.size,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <Box
                                className="w-full flex flex-row py-2 px-2 rounded-lg hover:bg-surface-3 gap-2 items-center justify-between cursor-pointer"
                                onClick={() => toggleItem?.(sectionIndex, virtualRow.index)}
                            >
                                <Text className="truncate">
                                    {monoLink.title}
                                </Text>

                                <Checkbox
                                    checked={monoLink.checked}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => toggleItem?.(sectionIndex, virtualRow.index)}
                                />
                            </Box>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

type BookmarkSectionMonolinksCardProps = {
    sections: any[];
    toggleSection?: (id: number) => void;
    toggleItem?: (sectionIndex: number, itemIndex: number) => void;
};

export const BookmarkSectionMonolinksCard = ({ sections, toggleSection, toggleItem }: BookmarkSectionMonolinksCardProps) => {
    return (
        <Vertical className="w-full space-y-4 pr-2 h-[60vh] overflow-y-auto dark-scrollbar relative">
            {sections.map((section, j) => (
                <Box
                    key={j}
                    className="w-full space-y-2 bg-card-primary rounded-lg border shadow-lg shadow-s"
                >
                    <HStack
                        className="justify-between cursor-pointer hover:bg-card-quaternary bg-surface-3 px-4 py-2 rounded-lg"
                        onClick={() => toggleSection?.(j)}
                    >
                        <Text>
                            {section.title} ({section.monoLinks.length})
                        </Text>

                        <Checkbox
                            checked={section.checked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSection?.(j)}
                            aria-label={`toggle-section-${j}`}
                        />
                    </HStack>

                    <div className="px-4">
                        <VirtualizedMonoLinks
                            monoLinks={section.monoLinks}
                            sectionIndex={j}
                            toggleItem={toggleItem}
                        />
                    </div>
                </Box>
            ))}

            <ConditionalRender renderIf={sections.length < 1}>
                <Bookmark className="w-40 h-40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-neutral-500" />
            </ConditionalRender>
        </Vertical>
    );
};