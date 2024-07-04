import {Bot, CommandContext, Context} from "grammy";
import {emojiParser, Reactions} from "@grammyjs/emoji";
import Logger from "reggol";
import {PatchouliConfig} from "./data/config";
import {StorageService, SummaryService} from "./service/services";
import {Message, MessageEntity} from "@grammyjs/types/message"

const LOG_MESSAGE_LEN_LIMIT = 35

export class Listener {
    private tgBot!: Bot
    private messageLogger: Logger

    constructor(
        bot: Bot,
        private config: PatchouliConfig,
        private storageSvc: StorageService,
        private summaryService: SummaryService
    ) {
        this.tgBot = bot
        this.messageLogger = new Logger("message")
        this.tgBot.on(['edited_channel_post:entities:url', 'edited_channel_post:entities:hashtag'], this.onMessage.bind(this))
        this.tgBot.on(['channel_post:entities:url', 'channel_post:entities:hashtag'], this.onMessage.bind(this))
        this.tgBot.command('summary', this.onSummaryCommand.bind(this))
        this.tgBot.command('invalidate', this.onInvalidateCommand.bind(this))
        this.tgBot.command('id', ctx => ctx.reply(String(ctx.chatId)))
        this.tgBot.on(['message'], this.onMessage.bind(this))
    }

    private async onMessage(ctx: Context) {
        let post = ctx.message ?? ctx.channelPost ?? ctx.editedChannelPost
        if (!post) return
        if (!this.hasHashTag(ctx.entities())) return
        let link = this.extractUrl(ctx.entities())
        if (!link) return
        await this.concludeSummary(ctx, link, post)
    }

    private async onInvalidateCommand(ctx: CommandContext<Context>) {
        if (typeof ctx.match != 'string') return;
        let pattern = ctx.match
        if (ctx.message.reply_to_message) {
            return this.onReplyingSummaryRequest(ctx)
        }
        let result = await this.storageSvc.removeSummary(pattern)
        await this.replyTo(result == 0
                ? "The requested url is not found in my memory."
                : `Deleted ${result} records according to your request.`
            , ctx, ctx.message)
    }

    private async onSummaryCommand(ctx: CommandContext<Context>) {
        if (ctx.channelPost) {
            if (ctx.channelPost.reply_to_message) return this.onReplyingSummaryRequest(ctx)
            return
        }
        if (typeof ctx.match != 'string') return;
        let link = ctx.match
        if (ctx.message.reply_to_message) {
            return this.onReplyingSummaryRequest(ctx)
        }
        if (!this.isURLValid(link)) {
            await this.replyTo("Invalid URL.", ctx, ctx.message)
            return;
        }
        await this.concludeSummary(ctx, link, ctx.message)
    }

    private async onReplyingSummaryRequest(ctx: Context) {
        let reply_to = ctx.message?.reply_to_message ?? ctx.channelPost?.reply_to_message
        if (!reply_to) return
        let _link = reply_to?.entities?.find(it => it.type == 'url')
        if (!reply_to.entities || !_link) {
            await this.tgBot.api.sendMessage(ctx.chatId, "Cannot find URL in your requested message.")
            return
        }
        let {offset, length} = _link as { offset: number, length: number }
        let link = reply_to.text?.substring(offset, offset + length)!
        await this.concludeSummary(ctx, link, ctx.message ?? ctx.channelPost!)
    }


    private async concludeSummary(ctx: Context, link: string, replyingMessage: Message) {
        this.messageLogger.info(`[${ctx.chat?.title!}]: ${link}`)
        if (!this.isURLValid(link)) {
            await this.replyTo("That seemed like a bad link.", ctx, replyingMessage)
            return
        }
        if(!this.config.trustedChats.includes(ctx.chatId)){
            await this.replyTo("You're not allowed to do this.", ctx, replyingMessage)
            return
        }
        await this.replyTo("Patchouli is reading this article, please wait...", ctx, replyingMessage)
            .then(msg => this._handleSummary(link, msg).then())
    }

    private async replyTo(text: string, context: Context, replyingMessage: Message) {
        return context.reply(text, {
            reply_parameters: {
                message_id: replyingMessage.message_id,
                chat_id: replyingMessage.chat.id
            }
        })
    }

    private extractUrl(entities: MessageEntity[]): string | undefined {
        if (!entities) return undefined;
        let _link = entities.find(it => it.type == 'url')
        if (!_link) return undefined
        return ((_link as unknown) as { text: string }).text
    }

    private hasHashTag(entities: MessageEntity[]): boolean {
        if (!entities) return false;
        return entities.find(i => i.type == 'hashtag' && this.config.hashtagTriggers.includes(((i as unknown) as {
            text: string
        }).text)) != undefined
    }

    private isCallingMe(tolerance: boolean = false, entities: MessageEntity[]): boolean {
        if (!entities) return false;
        return entities.find(it => it.type == 'bot_command' && ((it as unknown) as {
            text: string
        }).text == (tolerance ? '/summary' : `/summary@${this.tgBot.botInfo.username}`)) != undefined
    }

    private isURLValid(url: string) {
        try {
            new URL(url)
            return true
        } catch (_) {
            return false
        }
    }

    private async _handleSummary(link: string, message: Message.TextMessage) {
        let text = "";
        this.summaryService.summaryFromURL(
            link, update => {
                if (!update || update.replaceAll(' ', "").length == 0) return true
                if (text.length > 2048) return false;
                text += update
                if (text.length > 2048) {
                    text += "... (Interrupted due to abnormal length of response)"
                    return false;
                }
                this.tgBot.api.editMessageText(message.chat.id, message.message_id, text)
                return true
            })
            .then(() => this.messageLogger.info(`${link} is successfully summarized!`))
            .catch(err => {
                this.messageLogger.error(`Cannot summarize url ${link}, ${err}`)
                setTimeout(() => {
                    this.tgBot.api.editMessageText(message.chat.id, message.message_id,
                        !err!.toString().includes("CANCELLED")
                            ? `${text}\n\n(Model stopped generating texts.)`
                            : `${text}\n\n${err}`
                    )
                }, 3000) // avoid rate-limit causes.
            })
    }
}