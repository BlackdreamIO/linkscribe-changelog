import { describe, it, expect, vi } from "vitest";
import { DatabaseService } from "../src/modules/database-service";
import { MockSupabase, makeILink } from "./utils/test-helpers";
import type { IExtendedScrapLink } from "../src/modules/scrap-service";

describe("DatabaseService", () => {
    it("updateSharedLinksPaylod returns failed links on error", async () => {
        const supabase = new MockSupabase() as any;

        // Force an error for one update
        supabase.update = vi.fn().mockReturnThis();
        supabase.eq = vi.fn().mockReturnThis();
        supabase.update = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "db error" },
            }),
        }));

        const db = new DatabaseService(supabase);

        const link: IExtendedScrapLink = {
            ...makeILink("https://example.com", "link-1"),
            url: "https://example.com",
            final_url: null,
            title: "Example",
            description: "Desc",
            language: "en",
            author: "Author",
            published_date: null,
            format: "markdown",
            id: "db-id-1",
            url_hash: "hash-1",
            msg_id: "msg-1",
        };

        const failed = await db.updateSharedLinksPaylod([link]);

        expect(failed).toHaveLength(1);
        expect(failed[0].id).toBe("db-id-1");
        expect(failed[0].reason).toBe("error during update");
    });

    it("updateSharedLinksPaylod returns empty failed list on success", async () => {
        const supabase = new MockSupabase() as any;

        supabase.update = vi.fn().mockReturnThis();
        supabase.eq = vi.fn().mockReturnThis();
        supabase.update = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({
                data: {},
                error: null,
            }),
        }));

        const db = new DatabaseService(supabase);

        const link: IExtendedScrapLink = {
            ...makeILink("https://example.com", "link-1"),
            url: "https://example.com",
            final_url: null,
            title: "Example",
            description: "Desc",
            language: "en",
            author: "Author",
            published_date: null,
            format: "markdown",
            id: "db-id-1",
            url_hash: "hash-1",
            msg_id: "msg-1",
        };

        const failed = await db.updateSharedLinksPaylod([link]);

        expect(failed).toHaveLength(0);
    });
});