import { BookmarksParser } from "netscape-bookmark-parser/web";
import { urlNormalizeOrFail } from "url-normalize";

export async function processBookmarkFile(file: File) {
    const content = await file.text();
    
    // INTENT: Parse raw HTML bookmark file into a structured folder tree.
    // BOTTLENECK: Synchronous parsing of large HTML strings on the main thread blocks UI rendering.
    const bookmarkTree = BookmarksParser.parseFromHTMLString(content);
    // Recursively flattens nested bookmark structures into accessible array nodes.
    const folders = convertToFlatFolders(bookmarkTree);

    const allLinks = folders.flatMap((folder) => folder.links);
    const normalizedUrlByRawUrl = new Map<string, string>();

    // INTENT: Validate and normalize incoming raw URLs to standardize key indexing.
    // BOTTLENECK: Synchronous try/catch URL normalization inside a tight loop creates high CPU overhead for thousands of items.
    for (const link of allLinks) {
        try {
            const normalizedUrl = urlNormalizeOrFail(link.url);
            normalizedUrlByRawUrl.set(link.url, normalizedUrl);
        }
        catch {
            // Catches malformed or invalid URI structures for error reporting.
        }
    }

    return {
        totalLinks: allLinks.length,
        parsedUrls: normalizedUrlByRawUrl
    }
}