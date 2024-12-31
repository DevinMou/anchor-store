import useConnector, { MessageConnector } from '../messageConnector'
import { callObjectByPath, getTransferByTypes, callPathTracker, ramStr, CoverObjValueToPromise } from '../../utils/tool'

interface WorkerAdaptorOption<T> {
  workerPath?: string
  targetClass: T
  transferTypes?: Record<string, boolean>
  beforeInstanceHook?: (worker?: Worker) => void
}

export default class WorkerAdaptor<T extends ({ new(...args: any): any })> {
  useWorker = false
  worker?: Worker
  targetClass: T
  target?: InstanceType<T>
  transferTypes: Required<WorkerAdaptorOption<T>>['transferTypes']
  connector?: MessageConnector
  module: CoverObjValueToPromise<InstanceType<T>, true>
  constructor({ workerPath, targetClass, beforeInstanceHook, transferTypes = {
    ArrayBuffer: true,
    OffscreenCanvas: true,
    ImageBitmap: true
  } }: WorkerAdaptorOption<T>, ...payload: ConstructorParameters<T>) {
    this.targetClass = targetClass
    this.transferTypes = transferTypes
    if (workerPath === undefined) {
      if (beforeInstanceHook) {
        beforeInstanceHook()
      }
      this.target = new targetClass(...payload)
    } else {
      this.useWorker = true
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      if (beforeInstanceHook) {
        beforeInstanceHook(this.worker)
      }
      this.connector = useConnector(this.worker)
      this.connector.postMessage({
        type: 'inject',
        payload: [workerPath, transferTypes, ...payload]
      })
      this.connector.registerHandle('fnCallback', (data, context) => {
        const { hash } = data
        if (hash in context.promisePool) {
          context.promisePool[hash](data)
        }
      })
    }
    this.module = callPathTracker<InstanceType<T>>((param) => {
      const { callPath, callArgs, resolve } = param
      if (this.useWorker) {
        const hash = ramStr()
        let payload = undefined
        let transfer = undefined
        if (callArgs) {
          payload = callArgs.map(item => {
            if (typeof item === 'string') {
              return 'string_' + item
            } else if (typeof item === 'function') {
              const fnHash = ramStr()
              this.connector!.promisePool[fnHash] = (data) => item(...data.payload)
              return 'function_' + fnHash
            } else {
              return item
            }
          })
          const transferValues = getTransferByTypes(payload, this.transferTypes)
          payload = transferValues.value
          transfer = transferValues.transfer
        }
        this.connector!.postMessage({
          type: 'moduleCall',
          hash,
          callPath,
          payload,
          transfer
        }, (data) => resolve(data.payload[0]))
      } else {
        const res = callObjectByPath(this.target!, callPath, callArgs)
        if (res instanceof Promise) {
          res.then(value => resolve(value))
        } else {
          resolve(res)
        }
      }
    })

  }
}