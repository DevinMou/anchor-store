import { useAnchor, useStore } from "./store"
import { CoverObjValueToPromise } from "../src/utils/tool"
import WorkerAdaptor from "../src/core/workerAdaptor"
import B from "./b"

export default class A {
    moduleB: CoverObjValueToPromise<B, true>
    logger = useStore().logger
    constructor(useWorker = false) {
        const anchor = useAnchor()
        this.moduleB = new WorkerAdaptor({
            targetClass: B, workerPath: useWorker ? new URL('./b.ts', import.meta.url).href : undefined, beforeInstanceHook: (worker) => {
                anchor.drop(worker)
            }
        }).module
    }

    test() {
        this.logger.info('this is A test')
    }
    info() {
        console.log(21, this.logger)
        this.moduleB.info('this is B info')
    }
}