// deno-lint-ignore-file no-import-prefix no-explicit-any
import * as cheerio from 'npm:cheerio@1.0.0-rc.12';

interface IScrappedContent {
    description : string;
    content : string;
    stats : {
        wordCount : number;
    }
    title : string | null;
    ogImage : string | null;
}

export async function getScrapedContent(siteUrl: string) : Promise<IScrappedContent | any> {
    try {
        const response = await fetch(siteUrl, {
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'Mozilla/5.0...', 'Accept-Language': 'en-US,en;q=0.9' }
        })

        const rawHtml = await response.text();
        const $ = cheerio.load(rawHtml);

        $('script, style, noscript, img, svg, iframe, video, link, footer, nav, header, button, aside, .sidebar, .comments, .ads').remove();

        const description = $('meta[name="description"]').attr('content') || 
                            $('meta[property="og:description"]').attr('content') || "";

        const title = $('title').text() || $('meta[property="og:title"]').attr('content') || null;
        const ogImage = $('meta[property="og:image"]').attr('content') || null;

        let cleanedOutput = "";
        let wordCount = 0;
        const WORD_LIMIT = 10000;

        const container = $('article, main, #content, .post-content').first().length 
            ? $('article, main, #content, .post-content').first() 
            : $('body');

        const targetTags = 'h1, h2, h3, p, li';

        container.find(targetTags).each((_, el) => {
            if (wordCount >= WORD_LIMIT) return false;

            const $el = $(el);
            const text = $el.text().replace(/\s+/g, ' ').trim();

            if (text.length < 20 && !['h1', 'h2', 'h3'].includes(el.name)) return;
            if (/share on|read more|copyright|all rights reserved/i.test(text)) return;

            cleanedOutput += `<${el.name}>${text}</${el.name}>\n`;
            wordCount += text.split(/\s+/).length;
        })

        return {
            description,
            content: cleanedOutput,
            stats: { wordCount },
            title : title,
            ogImage
        }   
    }
    catch (error) {
        return error;
    }
}