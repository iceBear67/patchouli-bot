import * as events from "events";
import {SummaryRecord} from "../data/tables";

export interface StorageService {
    recordSummary(record: SummaryRecord): Promise<void>

    fetchRecordByUrl(url: string): Promise<SummaryRecord>

    removeSummary(urlPattern: string): Promise<number>
}

export interface SummaryService {
    summaryFromURL(url: string, emitter: (message: string) => void): Promise<string>
}