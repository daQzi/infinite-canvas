import assert from "node:assert/strict";

import { hasReadyModelChannel, type ModelChannel } from "../src/stores/use-config-store.ts";

function channel(patch: Partial<ModelChannel> = {}): ModelChannel {
    return {
        id: "test",
        name: "测试渠道",
        baseUrl: "https://api.example.com",
        apiKey: "test-key",
        apiFormat: "openai",
        models: ["test-model"],
        ...patch,
    };
}

assert.equal(hasReadyModelChannel([]), false, "没有渠道时不可完成配置");
assert.equal(hasReadyModelChannel([channel({ baseUrl: "   " })]), false, "Base URL 为空时不可完成配置");
assert.equal(hasReadyModelChannel([channel({ apiKey: "   " })]), false, "API Key 为空时不可完成配置");
assert.equal(hasReadyModelChannel([channel({ models: [] })]), false, "没有模型时不可完成配置");
assert.equal(hasReadyModelChannel([channel({ models: ["   "] })]), false, "模型名称为空白时不可完成配置");
assert.equal(hasReadyModelChannel([channel()]), true, "存在完整渠道时可以完成配置");

console.log("config readiness tests passed");
