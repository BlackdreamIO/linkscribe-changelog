import { Logger } from "../utils/logger";

export abstract class LoggerService {
    constructor(protected readonly logger: Logger) {}
}