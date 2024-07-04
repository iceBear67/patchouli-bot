import {SummaryService} from "../services";
import {ModelConfig} from "../../data/config";
import Logger from "reggol";
import {HfInference, HfInferenceEndpoint} from "@huggingface/inference";
import {Readability} from "@mozilla/readability";
import {Axios} from "axios";
import {SimpleSummaryService} from "./base";
import * as console from "console";

const jsdom = require("jsdom");
const {JSDOM} = jsdom;

export class HuggingFaceSummaryService extends SimpleSummaryService {
    private hf!: HfInferenceEndpoint;

    constructor(
        config: ModelConfig,
        readonly ignoreStatusCode: boolean,
        readonly mode: "summary" | "textgen"
    ) {
        super(config, new Logger("hg-summerizer"), ignoreStatusCode);
        this.initialize(config).then()
    }

    private async initialize(config: ModelConfig) {
        if (!config.model) {
            this.logger.warn("Model is not specified! Using google/pegasus-large as fallback.")
            config.model = "google/pegasus-large"
        }
        if (!config.accessToken) {
            this.logger.error("AccessToken is not supplied! Stop working...")
            return
        }
        if (config.endpointUrl) {
            this.hf = new HfInference(config.accessToken).endpoint(config.endpointUrl)
        } else {
            this.hf = new HfInference(config.accessToken)
        }
    }

    //   async summaryFromURL(url: string, updater: (message: string) => void) {
    //console.log(this.config.prompt.replace('%title%',article!.title).replace('%article%',content))
    //      updater(`${article!.title} \n`)
    // for await (const chunk of this.hf.chatCompletionStream({
    //     model: this.config.model,
    //     messages: [
    //         { role: "user", content: this.config.prompt.replace('%title%',article!.title).replace('%article%',content) },
    //     ]
    // })) {
    //     if (chunk.choices && chunk.choices.length > 0) {
    //         updater(chunk.choices[0].delta.content);
    //     }
    // }

    // let llmOut = await this.hf.chatCompletion({
    //     model: this.config.model,
    //     messages: [
    //         {
    //             role: "user",
    //             content: this.config.prompt.replace('%title%', article!.title).replace('%article%', content)
    //         },
    //     ]
    // })
    // console.log(llmOut.choices)

    // let llmOut = await this.hf.summarization(
    //     {
    //         model: this.config.model,
    //         inputs: `${article!.title} \n ${content}`
    //     }
    // )
    //this.logger.info(llmOut)
    //updater(`${article!.title}\n\n${llmOut.choices[llmOut.choices.length-1].message.content}`)
    //updater(`${article!.title}\n${llmOut.summary_text}`)
//    }

    async summaryFromArticle(title: string, content: string, updater: (message: string) => void): Promise<string> {
        if (!this.hf) {
            return Promise.reject("Inference API is improperly configured. Please check server log and fix.")
        }
        let total = ""
        let update = (str: string) => {
            total += str
            updater(str)
        }
        let usedTokens
        if (this.mode == "textgen") {
            let buf = "";
            for await (const output of this.hf.textGenerationStream({
                model: this.config.model,
                inputs: this.getPrompt(title, content),
                parameters: {
                    max_new_tokens: 384
                }
            })) {
                usedTokens++
                buf += output.token.text
                let shouldDisplay = buf.length > 100
                if (shouldDisplay) {
                    update(buf)
                    buf = ""
                }
            }
            if (buf) update(buf)
            update(`\n\nUsed Tokens: ${usedTokens}`)
        } else if (this.mode == "summary") {
            let llmOut = await this.hf.summarization(
                {
                    model: this.config.model,
                    inputs: this.getPrompt(title, content)
                }
            )
            update(llmOut.summary_text)
        }
        return Promise.resolve(total)
    }

}