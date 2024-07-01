import {Bot, Bot as TelegramBot, Context} from "grammy"
import Logger = require("reggol");
import {emojiParser, Reactions} from "@grammyjs/emoji";
import {Listener} from "./listener";
import {MinatoStorageService} from "./service/db/minatoStorageImpl";
import Database from "minato";
import {Tables} from "./data/tables";
import {PatchouliConfig} from "./data/config";
import {SQLiteDriver} from "@minatojs/driver-sqlite";
import {StorageService, SummaryService} from "./service/services";
import {HuggingFaceSummaryService} from "./service/summary/huggingFace";
import {OpenAISummaryService} from "./service/summary/openai";
import OpenAI from "openai";
import {CachedStorageService} from "./service/db/cache";
import {CachedSummaryService} from "./service/summary/cached";

export class PatchouliBot {
    public readonly bot!: TelegramBot
    public readonly logger: Logger
    public readonly storage: StorageService
    public readonly summarizer: SummaryService

    constructor(public readonly config: PatchouliConfig) {
        this.logger = new Logger("patchouli")
        this.storage = this.setupStorage()
        this.summarizer = new CachedSummaryService(this.setupSummarizer(), this.storage)
        this.bot = new Bot(config.botToken)
        this.bot.catch(error => this.logger.error(error))
        this.bot.use(emojiParser())
        new Listener(
            this.bot, config,
            this.storage, this.summarizer
        )
    }

    private setupStorage(config: PatchouliConfig = this.config): StorageService {
        let database = new Database<Tables>()
        database.connect(SQLiteDriver, {
            path: config.databasePath
        } as any).then()
        database.extend('records', {
            id: 'integer',
            summarizedText: 'text',
            url: {type: 'string', length: 512}
        } as any, {
            primary: 'id',
            autoInc: true
        })
        return new CachedStorageService(config.cacheConfig.summaryCacheTTL, new MinatoStorageService(database))
    }

    public start() {
        this.bot.start({
            allowed_updates: ["message", "channel_post", "edited_channel_post"],
        })
        this.logger.info("Started")
    }

    private setupSummarizer(): SummaryService {
        switch (this.config.backend) {
            case "huggingface":
                return new HuggingFaceSummaryService(
                    this.config.modelConfig,
                    this.config.ignoreAbnormalStatusCode,
                    this.config.mode
                )
            case "openai":
                return new OpenAISummaryService(
                    this.config.modelConfig,
                    this.config.ignoreAbnormalStatusCode
                )
        }
    }
}