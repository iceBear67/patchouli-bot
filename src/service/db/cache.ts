import {StorageService} from "../services";
import NodeCache from "node-cache";
import {SummaryRecord} from "../../data/tables";

export class CachedStorageService implements StorageService {
    private readonly cache

    constructor(
        ttl: number,
        private readonly delegatedStorage: StorageService
    ) {
        this.cache = new NodeCache({stdTTL: ttl, checkperiod: 10})
    }

    async fetchRecordByUrl(url: string) {
        if (!this.cache.has(url.trim())) {
            this.cache[url] = this.delegatedStorage.fetchRecordByUrl(url)
        }
        return this.cache[url]
    }

    async recordSummary(record: SummaryRecord) {
        if (this.cache.has(record.url.trim())) {
            this.cache.remove(record)
        }
        return this.delegatedStorage.recordSummary(record)
    }

    removeSummary(urlPattern: string) {
        for (let key of this.cache.keys()) {
            if (key.match(urlPattern)) this.cache.remove(urlPattern)
        }
        return this.delegatedStorage.removeSummary(urlPattern)
    }
}