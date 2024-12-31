import { Test } from "./index";
import { defindAnchorStore } from "../src/core/anchor";
import { Logger } from "./logger";

export const { createStore, useStore, useAnchor } = defindAnchorStore((context: Test) => ({
    logger: new Logger(context.config)
}))