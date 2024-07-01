import {ModelConfig} from "../../data/config";
import {SimpleSummaryService} from "./base";
import Logger from "reggol";
import OpenAI from 'openai';

export class OpenAISummaryService extends SimpleSummaryService {
    private readonly api!: OpenAI

    constructor(
        modelConfig: ModelConfig,
        ignoreStatusCode: boolean
    ) {
        super(modelConfig, new Logger("openai-summarizer"), ignoreStatusCode);
        this.api = new OpenAI({
            apiKey: modelConfig.accessToken,
            baseURL: modelConfig.endpointUrl
        })
    }

    async summaryFromArticle(title: string, content: string, updater: (message: string) => void): Promise<string> {
        updater(`# ${title} #\n`)
        let llmOut = await this.api.chat.completions.create({
            model: this.config.model,
            messages: [{
                role: 'user',
                content: this.getPrompt(title, content)
            }]
        })
        if (!llmOut.choices || !llmOut.choices[0].message.content) {
            return Promise.reject("Failed to generate summary!")
        } else {
            return Promise.resolve(llmOut.choices[0].message.content!)
        }
    }
}