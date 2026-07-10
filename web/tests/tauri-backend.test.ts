import assert from "node:assert/strict";

import { base64ToBytes, blobToBase64, invokeTauri, isTauriRuntime } from "../src/services/tauri-backend";

let receivedCommand = "";
let receivedArgs: Record<string, unknown> | undefined;

(globalThis as any).window = {
    __TAURI_INTERNALS__: {
        invoke: async (command: string, args?: Record<string, unknown>) => {
            receivedCommand = command;
            receivedArgs = args;
            return { ok: true };
        },
    },
};

assert.equal(isTauriRuntime(), true, "Tauri runtime is detected from injected internals");
assert.deepEqual(await invokeTauri("backend_ping", { value: 1 }), { ok: true }, "invokeTauri forwards commands");
assert.equal(receivedCommand, "backend_ping", "command name is forwarded");
assert.deepEqual(receivedArgs, { value: 1 }, "command arguments are forwarded");

const base64 = await blobToBase64(new Blob(["hello"], { type: "text/plain" }));
assert.equal(Buffer.from(base64, "base64").toString("utf8"), "hello", "Blob payload is encoded as base64");
assert.equal(Buffer.from(base64ToBytes(base64)).toString("utf8"), "hello", "base64 payload is decoded into bytes");

console.log("tauri backend tests passed");
