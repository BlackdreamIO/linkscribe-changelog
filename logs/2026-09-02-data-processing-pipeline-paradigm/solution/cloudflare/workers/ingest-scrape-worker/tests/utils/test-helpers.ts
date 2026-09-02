import type { ILink } from "../../src/types/Job.types";

export function makeMessageBatch(links: ILink[]) {
    const messages = links.map((link, i) => ({
        id: `msg-${i}`,
        body: link,
        timestamp: Date.now(),
    }));

    return messages;
}

export async function makeILink(url: string, url_hash: string, msg_id : string, id?: string): Promise<ILink & { msg_id : string }> {
    return {
        url,
        id: id ?? crypto.randomUUID(),
        url_hash,
        msg_id
    }
}

// Simple in-memory mock for Upstash Redis
export class MockRedis {
    private store = new Map<string, number>();

    async eval(lua: string, keys: string[], args: string[]) {
        // Very minimal mock for your rate-limit script
        const key = keys[0];
        const cost = Number(args[0]);
        const windowSeconds = Number(args[1]);

        const current = (this.store.get(key) ?? 0) + cost;
        this.store.set(key, current);

        // Fake TTL: always return the full window
        const ttl = windowSeconds;

        return [current, ttl];
    }
}

// Minimal Supabase mock
export class MockSupabase {
    private rows = new Map<string, any>();

    schema(_schema: string) {
        return this;
    }

    from(table: string) {
        return this;
    }

    update(data: Record<string, unknown>) {
        this._pendingUpdate = data;
        return this;
    }

    private _pendingUpdate?: Record<string, unknown>;
    private _where?: { id?: string };

    eq(key: string, value: string) {
        this._where = { [key]: value };
        return this;
    }

    async thenResolve({ data, error }: { data?: unknown; error?: unknown }) {
        return { data, error };
    }

    async updateSharedLinkMock(id: string, data: Record<string, unknown>) {
        this.rows.set(id, data);
        return { data: {}, error: null };
    }

    rpc(_rpcName: string, _params: Record<string, unknown>) {
        return {
        thenResolve: async (res: { data?: unknown; error?: unknown }) => res,
        };
    }
}