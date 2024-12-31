// @ts-check
/// <reference lib="webworker"/>
export type CoverObjValueToPromise<T extends object, Deep extends boolean = false> = {
  [k in keyof T]: T[k] extends (...args: any) =>
    Promise<any> ? T[k]
  : T[k] extends (...args: any) => infer R ? (...args: Parameters<T[k]>) => Promise<R>
  : T[k] extends Promise<any> ? T[k]
  : Deep extends true ? T[k] extends object ? CoverObjValueToPromise<T[k], Deep>
  : Promise<T[k]>
  : Promise<T[k]>
}

export const isInWorker = () => {
  return typeof importScripts === 'function'
}

export const ramStr = (n = 5) =>
  Array(n)
    .fill(1)
    .map(() => ((Math.random() * 36) | 0).toString(36))
    .join('')

export const getTransferByTypes = (value: any, transferTypes?: Record<string, boolean>) => {
  const transfer: any[] = []
  const traverser = (data: any) => {
    if (typeof data === 'object') {
      if (data) {
        if (Array.isArray(data)) {
          data.forEach(item => traverser(item))
        } else {
          let jump = false
          if (transferTypes?.['ArrayBuffer'] && 'buffer' in data && data['buffer'] instanceof ArrayBuffer) {
            transfer.push(data['buffer'])
            jump = true
          }
          if (transferTypes?.['OffscreenCanvas'] && 'OffscreenCanvas' in self && data instanceof self.OffscreenCanvas) {
            transfer.push(data)
            jump = true
          }
          if (transferTypes?.['ImageBitmap'] && 'ImageBitmap' in self && data instanceof self.ImageBitmap) {
            transfer.push(data)
            jump = true
          }
          if (!jump) {
            for (let k in data) {
              if (data.hasOwnProperty(k)) {
                traverser(data[k])
              }
            }
          }
        }
      }
    }
  }
  transferTypes && traverser(value)
  return {
    value,
    transfer
  }
}

interface ProxyCallerCallbackParam {
  callPath: string[]
  callArgs?: any[]
  resolve: (val: any) => void
  jump: () => void
}

export const callPathTracker = <T extends object>(callback: (param: ProxyCallerCallbackParam) => void) => {
  const signal = Symbol('ProxyCallerProp')
  const proxyCache: Record<string, Partial<T>> = {}
  const handle: ProxyHandler<any> = {
    get: (_target, p, receiver) => {
      if (typeof p === 'string') {
        const targetProp = Reflect.get(_target, signal)
        /* if (p === 'then' && !1) {
          const promise = new Promise(resolve => {
            callback({
              callPath: [...targetProp.path, 'then'], resolve, jump: () => resolve(targetProp.self)
            })
          })
          return Reflect.get(promise, p, receiver).bind(promise)
        } else { */
        const path = [...targetProp.path, p]
        const pathStr = path.join(',')
        if (!(pathStr in proxyCache)) {
          const proxy = new Proxy(() => { }, handle)
          Reflect.set(proxy, signal, { path, self: proxy })
          proxyCache[pathStr] = proxy
        }
        return proxyCache[pathStr]
        // }
      } else {
        return Reflect.get(_target, p, receiver)
      }
    },
    apply(_target, _thisArg, argArray) {
      const targetProp = Reflect.get(_target, signal)
      let path = targetProp.path as string[]
      let callArgs: undefined | any[] = argArray
      const promise = new Promise(resolve => {
        if (path.last() === 'call') {
          path = path.slice(0, -1)
          callArgs = argArray.slice(1)
        } else if (path.last() === 'apply') {
          path = path.slice(0, -1)
          callArgs = argArray[1]
        } else if (path.last() === 'then') {
          callArgs = undefined
        }
        callback({ callPath: path, callArgs, resolve, jump: () => resolve(targetProp.self) })
      })
      return promise.then(res => {
        if (path.last() === 'then') {
          const [resolve, _reject] = argArray
          if (typeof resolve === 'function') {
            argArray[0](res)
          }
        }
        return res
      })
    },
  }
  const proxy = new Proxy(() => { }, handle)
  Reflect.set(proxy, signal, { path: [], self: proxy })
  return proxy as T as CoverObjValueToPromise<T, true>
}

export const callObjectByPath = (target: object, paths: string[], payload?: any[]) => {
  let parentObj = target
  let obj = target
  while (paths.length && obj) {
    const k = paths.shift()!
    if (!paths.length && k === 'then') {
      continue
    }
    parentObj = obj
    obj = Reflect.get(obj, k)
  }
  if (payload && typeof obj === 'function') {
    obj = obj.apply(parentObj, payload)
  }
  if (obj instanceof Promise) {
    return obj
  } else {
    return Promise.resolve(obj)
  }
}