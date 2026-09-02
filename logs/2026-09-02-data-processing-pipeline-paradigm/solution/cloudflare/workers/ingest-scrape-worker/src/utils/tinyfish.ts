import { TinyFish } from "@tiny-fish/sdk";
import { env } from "cloudflare:workers";

let tinyFish : TinyFish;

export const getTinyFish = () => {
    if(!tinyFish) {
        tinyFish = new TinyFish({ apiKey: env.TINY_FISH_API });
    }
    return tinyFish;
}