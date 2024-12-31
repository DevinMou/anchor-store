import { createStore, useAnchor } from './store'
import A from './a'

export class Test {
    private anchor
    moduleA?: A
    constructor(public config: {}) {
        createStore(this)
        this.anchor = useAnchor()
    }

    loadModuleA() {
        this.anchor.drop()
        this.moduleA = new A(true)
    }
}