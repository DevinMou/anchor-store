import { isInWorker, ramStr } from "../utils/tool";

interface MessageType {
    type: string
    callPath: string[]
    payload: any[]
    hash: string;
}

export class MessageConnector {
    constructor(private target: Worker | DedicatedWorkerGlobalScope) {
        const messageCallback = this.onMessage.bind(this) as EventListener
        target.addEventListener('message', messageCallback)
        this.destroyCallbackQueue.push(() => target.removeEventListener('message', messageCallback))

        this.registerHandle('call', (data, context) => {

        })
        this.registerHandle('callback', (data, context) => {
            const { hash } = data
            if (hash in context.promisePool) {
                context.promisePool[hash](data)
                delete context.promisePool[hash]
            }
        })
    }
    promisePool: Record<string, (data: MessageType) => any> = {}
    messageHandleDist: Record<string, ((data: MessageType, context: MessageConnector) => void)[]> = {}
    registerHandle(type: string, handle: (data: MessageType, context: MessageConnector) => void, cover = false) {
        if (!this.messageHandleDist[type]) {
            this.messageHandleDist[type] = []
        }
        if (cover) {
            this.messageHandleDist[type].length = 0
        }
        this.messageHandleDist[type].push(handle)
    }
    onMessage(event: MessageEvent<MessageType>) {
        try {
            const { type } = event.data
            if (type in this.messageHandleDist) {
                const handles = this.messageHandleDist[type]
                handles.forEach(handle => {
                    handle(event.data, this)
                })
            }
        } catch (err) {

        }
    }
    postMessage(data: Partial<MessageType> & { transfer?: Transferable[] }, waitPromiseResolve: (value: MessageType) => void): string
    postMessage(data: Partial<MessageType> & { transfer?: Transferable[] }): void
    postMessage(data: Partial<MessageType> & { transfer?: Transferable[] }, waitPromiseResolve?: (value: MessageType) => void) {
        const { transfer = [], ...message } = data
        if (waitPromiseResolve) {
            message.hash = message.hash || ramStr()
            this.promisePool[message.hash] = waitPromiseResolve
        }
        this.target.postMessage(message, transfer)
        return message.hash
    }

    private destroyCallbackQueue: (() => void)[] = []
    destroy() {
        this.destroyCallbackQueue.forEach(fn => fn())
        this.destroyCallbackQueue.length = 0
    }
}
let workerConnector: MessageConnector | undefined
const useConnector = (target?: Worker | DedicatedWorkerGlobalScope) => {
    if (isInWorker()) {
        if (!workerConnector) {
            workerConnector = new MessageConnector(target || (self as DedicatedWorkerGlobalScope))
        }
        return workerConnector
    } else if (target) {
        return new MessageConnector(target)
    } else {
        throw (new Error('target can not is unefined without worker'))
    }
}
export default useConnector