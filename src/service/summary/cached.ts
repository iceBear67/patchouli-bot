import {StorageService, SummaryService} from "../services";
import Logger from "reggol";
import {sleep} from "openai/core";
import {SummaryRecord} from "../../data/tables";

export class CachedSummaryService implements SummaryService {
    private readonly fetchingUrls = new Map<string, Array<(result: string, err: Error) => void>>()
    private readonly logger: Logger = new Logger("cache")

    constructor(
        private readonly delegatedObject: SummaryService,
        private readonly storage: StorageService
    ) {
    }

    async summaryFromURL(url: string, emitter: (message: string) => boolean): Promise<string> { // 好像能用又好像不能用的擦车
        url = url.trim()
        if (this.fetchingUrls.has(url)) {
            this.logger.info(`Waiting another running promise for ${url}`)
            this.fetchingUrls.get(url)?.push((result, err) => {
                emitter(`Cannot fetch summary for url ${url}, ${err}`)
                emitter(err?.message ?? result)
            })
            return Promise.resolve("")
        }
        this.fetchingUrls[url] = []
        try {
            let record = await this.storage.fetchRecordByUrl(url)
            emitter(record.summarizedText)
            this.fetchingUrls[url].forEach(it => it(record.summarizedText, undefined))
            this.fetchingUrls.delete(url)
        } catch (e) {
            return this.delegatedObject.summaryFromURL(url, emitter)
                .then(msg => {
                    this.logger.info(`Saving summary for ${url}`)
                    this.storage.recordSummary(new SummaryRecord(url, msg))
                    this.fetchingUrls[url].forEach(async it => {
                        it(msg, undefined)
                        await sleep(2000) // prevent request flooding
                    })
                    this.fetchingUrls.delete(url)
                    return msg
                })
        }
    }
}