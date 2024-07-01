import Database from "minato";
import {SummaryRecord, Tables} from "../../data/tables";
import {StorageService} from "../services";


export class MinatoStorageService implements StorageService {

    constructor(private db: Database<Tables>) {
    }

    async recordSummary(record: SummaryRecord) {
        await this.db.create('records', record)
    }

    async fetchRecordByUrl(url: string) {
        let result = await this.db.get('records', {
            url: url
        })
        if (result.length == 0) {
            return Promise.reject(`Cannot find ${url} in database`)
        }
        return result[0]
    }

    async removeSummary(pattern: string) {
        let result = await this.db.remove('records', {
            url: {$regex: pattern}
        })
        return result.removed
    }
}