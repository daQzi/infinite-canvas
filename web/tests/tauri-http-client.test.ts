import assert from "node:assert/strict";

import { httpGet, httpPost, isTauriRuntime } from "../src/services/api/http-client";

function toBase64(value: string) {
    return Buffer.from(value).toString("base64");
}

function fromBase64(value: string | undefined) {
    return Buffer.from(value || "", "base64").toString("utf8");
}

let capturedPayload: Record<string, unknown> | undefined;

(globalThis as any).window = {
    __TAURI_INTERNALS__: {
        invoke: async (command: string, args: { payload: Record<string, unknown> }) => {
            capturedPayload = args.payload;
            assert.equal(command, "tauri_http_request");
            return {
                status: 200,
                headers: { "content-type": "application/json" },
                bodyBase64: toBase64(JSON.stringify({ ok: true })),
            };
        },
    },
};

assert.equal(isTauriRuntime(), true, "Tauri IPC runtime is detected");

const jsonResponse = await httpPost<{ ok: boolean }>("https://provider.example/v1/images/generations", { prompt: "hello" }, { headers: { Authorization: "Bearer test-key" } });
assert.deepEqual(jsonResponse.data, { ok: true }, "JSON response is decoded");
assert.equal(capturedPayload?.method, "POST", "method is forwarded");
assert.equal(capturedPayload?.url, "https://provider.example/v1/images/generations", "URL is forwarded");
assert.equal((capturedPayload?.headers as Record<string, string>).authorization, "Bearer test-key", "headers are normalized");
assert.equal((capturedPayload?.headers as Record<string, string>)["content-type"], "application/json", "JSON content type is added");
assert.equal(fromBase64(capturedPayload?.bodyBase64 as string), JSON.stringify({ prompt: "hello" }), "JSON body is base64 encoded");

const form = new FormData();
form.set("prompt", "edit me");
await httpPost("https://provider.example/v1/images/edits", form);
assert.equal((capturedPayload?.headers as Record<string, string>)["content-type"].startsWith("multipart/form-data; boundary="), true, "FormData content type carries a multipart boundary");
assert.match(fromBase64(capturedPayload?.bodyBase64 as string), /name="prompt"\r\n\r\nedit me/, "FormData body is serialized");

await httpGet("https://provider.example/v1/models");
assert.equal(capturedPayload?.method, "GET", "GET requests are forwarded");
assert.equal(capturedPayload?.bodyBase64, undefined, "GET requests do not send an empty body");

console.log("tauri http client tests passed");
