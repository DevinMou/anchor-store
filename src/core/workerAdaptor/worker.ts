// @ts-check
/// <reference lib="webworker"/>

import useConnector, { MessageConnector } from "../messageConnector"
import { getTransferByTypes } from "../../utils/tool"
import '../polyfill'

class CommonWorker {
  instance: any
  inited: Promise<any>
  transferTypes?: Record<string, boolean>
  connector: MessageConnector
  constructor(context: DedicatedWorkerGlobalScope) {
    this.connector = useConnector(context)
    this.inited = new Promise(resolve => {
      this.connector.registerHandle('inject', (data) => {
        const { payload } = data
        try {
          this.transferTypes = payload[1]
          import(/* @vite-ignore */payload[0]).then(({ default: module }) => {
            this.instance = new module(...payload.slice(2))
            resolve(this.instance)
          })
        } catch (err) {
          console.log(err)
        }
      })

      this.connector.registerHandle('moduleCall', (data) => {
        const { hash, payload, callPath } = data
        const callName = callPath[0]
        this.inited.then(() => {
          const target = this.instance[callName]
          if (typeof target === 'function') {
            const localPayload = payload.map(item => {
              if (typeof item === 'string') {
                if (item.startsWith('string_')) {
                  return item.replace(/^string_/, '')
                } else if (item.startsWith('function_')) {
                  const fnHash = item.replace(/^function_/, '')
                  const fn = (...args: any[]) => {
                    this.connector.postMessage({ type: 'fnCallback', hash: fnHash, payload: args, transfer: getTransferByTypes(args, this.transferTypes).transfer })
                  }
                  return fn
                } else {
                  return item
                }
              } else {
                return item
              }
            })
            const res = target.apply(this.instance, localPayload)
            if (res instanceof Promise) {
              res.then(value => {
                this.connector.postMessage({
                  type: 'callback',
                  hash,
                  payload: [value],
                  transfer: getTransferByTypes(value, this.transferTypes).transfer
                })
              })
            } else {
              this.connector.postMessage({
                type: 'callback',
                hash,
                payload: [res],
                transfer: getTransferByTypes(res, this.transferTypes).transfer
              })
            }
          } else {
            this.connector.postMessage({
              type: 'callback',
              hash,
              payload: [target],
              transfer: getTransferByTypes(target, this.transferTypes).transfer
            })
          }
        })
      })
    })

  }
}

export default new CommonWorker(self as DedicatedWorkerGlobalScope)