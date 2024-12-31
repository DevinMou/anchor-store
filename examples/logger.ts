import { ramStr } from "../src/utils/tool"

export class Logger {
    private readonly hash = ramStr()
    constructor(config: any) { }
    info(message: string) {
        console.info(`[${this.hash}][info]: ${message}`)
    }
}
