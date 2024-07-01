export interface Tables {
    records: SummaryRecord
}

export class SummaryRecord {
    id!: number
    summarizedText: string
    url: string

    constructor(url: string, summarizedText: string) {
        this.url = url;
        this.summarizedText = summarizedText
    }
}