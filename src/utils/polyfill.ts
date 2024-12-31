declare global {
  interface Array<T> {
    last(n?: number): T | undefined
    remove(e: T): boolean
  }
}

Array.prototype.last = function (n = 0) {
  const index = this.length - (1 + n)
  return this[index < 0 ? 0 : index]
}

Array.prototype.remove = function (item) {
  const index = this.indexOf(item)
  if (index > -1) {
    this.splice(index, 1)
  }
  return index > -1
}

export default {}
