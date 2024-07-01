export class PatchouliConfig {
    constructor(
        public botToken: string = 'changeme',
        public databasePath: string = './data.db',
        public hashtagTriggers: Array<string> = ["#summary"],
        public ignoreAbnormalStatusCode: boolean = true,
        public backend: "openai" | "huggingface" = "huggingface",
        public mode: "summary" | "textgen" = "textgen",
        public cacheConfig: CacheSetting = new CacheSetting(300),
        public modelConfig: ModelConfig = new ModelConfig("", "", "")
    ) {
    }
}

export class CacheSetting {
    constructor(
        public summaryCacheTTL: number
    ) {
    }
}

export class ModelConfig {
    constructor(
        public accessToken: string,
        public model: string,
        public endpointUrl: string,
        public prompt: string = "Please edit prompt.txt"
    ) {
    }

}