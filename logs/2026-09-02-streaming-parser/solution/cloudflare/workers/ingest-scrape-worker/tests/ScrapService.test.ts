import { describe, it, expect, vi } from "vitest";
import { ScrapService } from "../src/modules/scrap-service";
import { makeILink } from "./utils/test-helpers";

describe("ScrapService", () => {
    it("scrapLinks returns scraped links when no errors", async () => {
        const mockTinyfish = {
            fetch: {
                getContents: vi.fn().mockResolvedValue({
                    results: [
                        {
                            url: "https://example.com",
                            final_url: "https://example.com",
                            title: "Example",
                            description: "Desc",
                            language: "en",
                            author: "Author",
                            published_date: null,
                            format: "markdown" as const,
                        },
                    ],
                    errors: [],
                }),
            },
        } as any;

        const service = new ScrapService(mockTinyfish);

        const job = await makeILink("https://example.com", "XHSYYYZZZ", "msg-1");

        const { scrapedLinks, scrapedFailed } = await service.scrapLinks([job]);

        expect(scrapedLinks).toHaveLength(1);
        expect(scrapedFailed).toHaveLength(0);
        expect(scrapedLinks[0].url).toBe("https://example.com");
    });

    it("scrapLinks returns failed links when TinyFish returns error", async () => {
        const mockTinyfish = {
            fetch: {
                getContents: vi.fn().mockResolvedValue({
                results: [],
                errors: [{ error: "timeout" }],
                }),
            },
        } as any;

        const service = new ScrapService(mockTinyfish);

        const job = await makeILink("https://example.com", "XHSYYYZZZ", "msg-1");

        const { scrapedLinks, scrapedFailed } = await service.scrapLinks([job]);

        expect(scrapedLinks).toHaveLength(0);
        expect(scrapedFailed).toHaveLength(1);
        expect(scrapedFailed[0].reason).toBe("timeout");
    });
});