import TurndownService from 'npm:turndown';

export function convertHtmlToMarkdown(html: string): string {
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    });

    turndownService.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe', 'img', 'svg']);

    let markdown = turndownService.turndown(html);

    markdown = markdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();

    return markdown;
}