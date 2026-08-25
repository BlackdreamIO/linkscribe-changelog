import { CreateMonoLinkFromUI } from '@/interface/MonoLink';
import { CreateSectionFromUI } from '@/interface/Section';
import * as Comlink from 'comlink';

export interface BookmarkWorkerAPI {
    parseBookmarks : (htmlText: string, userId: string) => Promise<{ sectionList: CreateSectionFromUI[], linkList: CreateMonoLinkFromUI[]}>;
}

const MonoLinkWorkerAPI : BookmarkWorkerAPI = {
    async parseBookmarks(htmlText: string, userId: string): Promise<{ sectionList: CreateSectionFromUI[], linkList: CreateMonoLinkFromUI[] }> {
        const sectionList: CreateSectionFromUI[] = [];
        const linkList: CreateMonoLinkFromUI[] = [];

        const sectionRegex = /<H3.*?>(.*?)<\/H3>\s*<DL>(.*?)<\/DL>/gis;
        const linkRegex = /<A HREF="(.*?)".*?>(.*?)<\/A>/gi;

        let sectionMatch;
        while ((sectionMatch = sectionRegex.exec(htmlText)) !== null) {
            const sectionTitle = sectionMatch[1];
            const innerHtml = sectionMatch[2] ?? '';
            const sectionId = crypto.randomUUID();

            sectionList.push({
                title: sectionTitle,
                userId: userId,
            } as CreateSectionFromUI);

            let linkMatch;
            while ((linkMatch = linkRegex.exec(innerHtml)) !== null) {
                linkList.push({
                    sectionId,
                    url: linkMatch[1],
                    title: linkMatch[2],
                    userId: userId,
                } as CreateMonoLinkFromUI);
            }
        }

        return { sectionList, linkList };
    }
}

Comlink.expose(MonoLinkWorkerAPI);
