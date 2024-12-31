import useConnector from './messageConnector'
import { callObjectByPath, isInWorker, callPathTracker, ramStr, CoverObjValueToPromise } from '../utils/tool'
const anchors: Record<string, Anchor> = {}
let currentAnchorHash = ''

class Anchor {
    readonly hash = ramStr()
    constructor() {
        anchors[this.hash] = this
    }
    data: Record<string, any> = {}
    getInsProxy() { }
    drop(worker?: Worker) {
        if (worker) {
            const connector = useConnector(worker)
            connector.registerHandle('anchorCall', (data) => {
                const { hash, callPath, payload } = data
                const [prop, ...paths] = callPath
                callObjectByPath(this.data[prop], paths, payload).then(res => {
                    if (typeof res === 'function' || (res && typeof res === 'object' && res.constructor !== Object)) {
                        connector.postMessage({ type: 'jumpCallback', hash, payload: [] })
                    } else {
                        connector.postMessage({ type: 'callback', hash, payload: [res] })
                    }
                })
            })
        }
    }
    set(prop: string, value: any) {
        this.data[prop] = value
    }
    get<T extends object>(prop: string, useProxy?: false): T
    get<T extends object>(prop: string, useProxy: true): CoverObjValueToPromise<T, true>
    get<T extends object>(prop: string, useProxy?: boolean) {
        if (!useProxy) {
            return this.data[prop] as T
        } else {
            const proxy = callPathTracker<T>(async ({ callPath, callArgs, resolve }) => {
                resolve(callObjectByPath(this.data[prop], callPath, callArgs))
            })
            return proxy
        }
    }
}

const createAnchor = () => {
    const anchor = new Anchor()
    currentAnchorHash = anchor.hash
    return anchor
}

const useAnchor = (): Anchor => {
    return anchors[currentAnchorHash]
}
let workerAnchor: ReturnType<typeof createWorkerAnchor> | undefined
const createWorkerAnchor = () => {
    const connector = useConnector()
    let getProp = ''
    const proxy = callPathTracker(async ({ callPath, callArgs, resolve, jump }) => {
        connector.postMessage({
            type: 'anchorCall',
            callPath: [getProp, ...callPath],
            payload: callArgs
        }, (data) => {
            if (data.type === 'jumpCallback') {
                jump()
            } else {
                resolve(data.payload[0])
            }
        })
    })
    return {
        get: <T extends object>(prop: string) => {
            getProp = prop
            return proxy as T as CoverObjValueToPromise<T, true>
        }
    }
}

interface UseStore<T extends object> {
    (maybeInWorker?: false): T
    (maybeInWorker: true): CoverObjValueToPromise<T, true>
}

export const defindAnchorStore = <T extends Record<string, any>, C extends any>(dataProcess: (context: C) => T, shareStore?: Record<string, any>) => {
    const useStore: UseStore<T> = <T extends object>(maybeInWorker = false) => {
        if (!maybeInWorker) {
            const anchor = useAnchor()
            return anchor.get<T>('store')
        } else {
            if (isInWorker()) {
                if (!workerAnchor) {
                    workerAnchor = createWorkerAnchor()
                }
                return workerAnchor!.get<T>('store')
            } else {
                const anchor = useAnchor()
                return anchor.get<T>('store', true)
            }
        }
    }
    return {
        createStore: (context: C) => {
            const anchor = createAnchor()
            anchor.set('store', dataProcess(context))
        },
        useStore,
        useAnchor
    }
}