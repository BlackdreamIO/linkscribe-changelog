import { IJob } from "../../../interfaces/IBase.ts";
import { log } from "../../../lib/logger.ts";
import { getScrapedContent, convertHtmlToMarkdown } from "./repository/handler.ts";

export interface IScrapedData {
    url: string;
    status: 'SUCCESS' | "FAILED";
    title: string;
    description?: string;
    og_img?: string;
    content : string;
    id: string;
    url_hash : string;
    msg_id : number;
    error? : string;
}

export async function getScrapedSharedLinks(sharedLinks : IJob[]) : Promise<IScrapedData[]> {
    try {
        log("info", "ELASTIC-LINK-PROCESSING", { message : "⌛ MonoLink Scraping started", sharedLinks : sharedLinks });

        const processes = sharedLinks.map(async ({ message : { url, url_hash, id }, msg_id }) : Promise<IScrapedData> => {

            try {
                const scrapedContent = await getScrapedContent(url);

                if(!scrapedContent) {
                    return {
                        id,
                        msg_id,
                        url,
                        url_hash,
                        content : 'NA',
                        description : "NA",
                        status : "FAILED",
                        title : "NA",
                        og_img : "NA",
                        error : 'Scraped content is null or empty'
                    }
                }

                const cleanedContent = convertHtmlToMarkdown(scrapedContent?.content ?? 'NA');

                const structuredContent = {
                    content : cleanedContent,
                    title : scrapedContent.title,
                    description : scrapedContent.description,
                    og_img : scrapedContent.ogImage,
                    url,
                    id,
                    url_hash,
                    status: "SUCCESS" as const,
                    msg_id,
                } as IScrapedData

                return structuredContent;
            }
            catch (error : any) {
                return {
                    id,
                    msg_id,
                    url,
                    url_hash,
                    content : 'NA',
                    description : "NA",
                    status : "FAILED",
                    title : "NA",
                    og_img : "NA",
                    error : 'Scraper failed due to an exception'
                };
            }
        });

        const results = await Promise.allSettled(processes);

        const scrapedLinks: IScrapedData[] = [];

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const data = result.value;
                if (data.status === 'SUCCESS') {
                    if(!data?.title || !data.description) {
                        scrapedLinks.push({
                            ...data,
                            status : "FAILED",
                            error : "Title or Description not found"
                        });
                        continue;
                    }

                    scrapedLinks.push(data as IScrapedData);
                }
                else {
                    scrapedLinks.push({
                        ...data,
                        status : "FAILED",
                        error : "Scraper failed due to an exception"
                    });
                }
            }
        }

        log("info", "ELASTIC-LINK-PROCESSING", { message : "✅ MonoLink Scraping completed" });

        return scrapedLinks;    
    }
    catch (_error) {
        return []
    }
}