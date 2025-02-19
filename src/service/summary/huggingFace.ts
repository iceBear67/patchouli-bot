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

    async summaryFromArticle(url: string, title: string, content: string, updater: (message: string) => boolean): Promise<string> {
        if (!this.hf) {
            return Promise.reject("Inference API is improperly configured. Please check server log and fix.")
        }
        let total = ""

        function update(str: string): boolean {
            total += str
            return updater(str)
        }

        let usedTokens = 0
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
                    if (!update(buf)) {
                        buf = ""
                        break;
                    }
                    buf = ""
                }
            }
            if (buf) update(buf)
            update(`\n\nUsed Tokens: ${usedTokens}`)
            update(`\nsrc: ${url}`)
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