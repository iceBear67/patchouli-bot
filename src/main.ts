import {PatchouliBot} from "./app"
import * as fs from "fs";
import {parse, stringify} from 'smol-toml'
import {ModelConfig, PatchouliConfig} from "./data/config";
import {HuggingFaceSummaryService} from "./service/summary/huggingFace";

let config!: PatchouliConfig

function initConfig() {
    if (!fs.existsSync("./config.toml")) {
        config = new PatchouliConfig()
        fs.writeFileSync("./config.toml", stringify(config))
    } else {
        let _config = fs.readFileSync("./config.toml", 'utf-8')
        config = (parse(_config) as unknown) as PatchouliConfig
    }
    if (!fs.existsSync("./prompt.txt")) {
        fs.writeFileSync("./prompt.txt", "Generate one paragraph of summary of the given article, containing only the main point of the article, only one paragraph. Title: %title%  Article: %article%")
    }
    config.modelConfig.prompt = fs.readFileSync("./prompt.txt", "utf-8")
}

async function main() {
    initConfig()
    if (config.botToken == 'changeme') {
        console.error("Please configure your bot first!")
        return
    }
    await new PatchouliBot(config).start()
}

main().then()
