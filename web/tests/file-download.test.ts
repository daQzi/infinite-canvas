import assert from "node:assert/strict";

import { saveFile } from "../src/services/file-download";

const calls: { command: string; args?: Record<string, any> }[] = [];

(globalThis as any).window = {
    __TAURI_INTERNALS__: {
        invoke: async (command: string, args?: Record<string, any>) => {
            calls.push({ command, args });
            return { status: "saved", path: "/tmp/download" };
        },
    },
};

await saveFile({ kind: "url", url: "blob:test", storageKey: "image:1" }, "image.png");
assert.equal(calls.at(-1)?.command, "tauri_save_file", "Tauri downloads use the native command");
assert.deepEqual(calls.at(-1)?.args?.payload.source, { kind: "storage", storageKey: "image:1" }, "stored media stays inside the Rust backend");

await saveFile({ kind: "url", url: "https://example.com/video.mp4" }, "video.mp4");
assert.deepEqual(calls.at(-1)?.args?.payload.source, { kind: "url", url: "https://example.com/video.mp4" }, "HTTP media is downloaded directly by Rust");
assert.equal("path" in calls.at(-1)!.args!.payload, false, "the frontend cannot choose an arbitrary destination path");

await saveFile({ kind: "url", url: "data:text/plain;base64,aGk=" }, "note.txt");
assert.equal(Buffer.from(calls.at(-1)?.args?.payload.source.bodyBase64, "base64").toString(), "hi", "data URLs keep their original bytes");

await saveFile({ kind: "blob", blob: new Blob(["zip"]) }, "canvas.zip");
assert.equal(calls.at(-1)?.args?.payload.source.kind, "base64", "generated files are encoded for the native command");
assert.equal(Buffer.from(calls.at(-1)?.args?.payload.source.bodyBase64, "base64").toString(), "zip", "generated file bytes are preserved");

assert.deepEqual(calls.at(-1)?.args?.payload.fileName, "canvas.zip", "the suggested filename is forwarded");

console.log("file download tests passed");
