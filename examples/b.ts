import { useStore } from "./store";

export default class B {
    logger = useStore(true).logger
    name = 'B'
    info: typeof this['logger']['info']
    constructor() {
        this.info = this.logger.info
    }
    test() {
        this.logger.info('this is B test')
    }
    getStr(str: string) {
        return str
    }
}