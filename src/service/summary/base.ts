import {SummaryService} from "../services";
import {ModelConfig} from "../../data/config";
import {Readability} from "@mozilla/readability";
import Logger from "reggol";
import {Axios} from "axios";

const jsdom = require("jsdom");
const {JSDOM} = jsdom;

export abstract class SimpleSummaryService implements SummaryService {
    protected readonly axios: Axios = new Axios(
        {
            headers: {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'},
            maxRedirects: 5
        }
    )

    constructor(
        protected readonly config: ModelConfig,
        readonly logger: Logger,
        readonly ignoreStatusCode: boolean
    ) {
    }

    async summaryFromURL(url: string, updater: (message: string) => boolean): Promise<string> {
        this.logger.info(`Fetching document from ${url}`)
        let resp = await this.axios.get(url)
        if (resp.status != 200) {
            if (this.ignoreStatusCode) {
                updater(`⚠ The website returned a ${resp.status}, which indicates possible errors in the following summaries.`)
            } else {
                updater(`⚠ Summary failed due to a ${resp.status} returned from server.`)
                return Promise.reject(`⚠ Summary failed due to a ${resp.status} returned from server.`)
            }
        }
        this.logger.info(`Start parsing ${url}`)
        let dom = new JSDOM(resp.data as string, {url: url})
        let reader = new Readability(dom.window.document);
        let article = reader.parse()
        let content = article?.textContent
        if (!article || !content) {
            this.logger.warn(`Cannot parse ${url}`)
            updater('\nFAILED to parse article! please contact bot administrator or the bot is banned from this site.')
            return
        }
        return this.summaryFromArticle(url,article!.title, content, updater)
    }

    protected getPrompt(title: string, content: string): string {
        return this.config.prompt.replace('%title%', title).replace('%article%', content)
    }

    abstract summaryFromArticle(url: string, title: string, content: string, updater: (message: string) => boolean): Promise<string>

}