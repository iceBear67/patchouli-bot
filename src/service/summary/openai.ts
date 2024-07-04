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
        let llmOut = await this.api.chat.completions.create({
            model: this.config.model,
            messages: [{
                role: 'user',
                content: this.getPrompt(title, content)
            }],
            stream: true,
            stream_options: {
                include_usage: true
            }
        })
        let total = ""
        let update = (str: string) => {
            total += str
            updater(str)
        }
        let buf = ""
        let totalTokens
        for await (const chunk of llmOut) {
            totalTokens = chunk?.usage?.total_tokens ?? 0
            let out = chunk.choices[0]?.delta?.content || ''
            buf += out
            if (buf.length >= 100) {
                update(buf)
                buf = ""
            }
        }
        if (buf) update(buf)
        update(`\n\nUsed Tokens: ${totalTokens}`)
        return Promise.resolve(total)
    }
}