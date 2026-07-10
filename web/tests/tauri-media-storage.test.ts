import assert from "node:assert/strict";

import { deleteStoredMedia, getMediaBlob, setMediaBlob } from "../src/services/file-storage";

const stored = new Map<string, { bodyBase64: string; mimeType: string }>();
const deleted: string[] = [];

(globalThis as any).window = {
    __TAURI_INTERNALS__: {
        invoke: async (command: string, args?: Record<string, any>) => {
            if (command === "tauri_store_media_file") {
                const payload = args?.payload;
                stored.set(payload.storageKey, { bodyBase64: payload.bodyBase64, mimeType: payload.mimeType });
                return { storageKey: payload.storageKey, bytes: 5, mimeType: payload.mimeType };
            }
            if (command === "tauri_read_media_file") {
                const payload = args?.payload;
                const item = stored.get(payload.storageKey);
                return item ? { bodyBase64: item.bodyBase64, mimeType: item.mimeType, bytes: 5 } : null;
            }
            if (command === "tauri_delete_media_files") {
                deleted.push(...args!.payload.storageKeys);
                return null;
            }
            throw new Error(`unexpected command: ${command}`);
        },
    },
};

const source = new Blob(["hello"], { type: "video/mp4" });
const url = await setMediaBlob("video:test", source);
assert.equal(url.startsWith("blob:"), true, "stored Tauri media is exposed as an object URL");

const blob = await getMediaBlob("video:test");
assert.equal(await blob?.text(), "hello", "stored media can be read back from Tauri");
assert.equal(blob?.type, "video/mp4", "stored media keeps its MIME type");

await deleteStoredMedia(["video:test"]);
assert.deepEqual(deleted, ["video:test"], "delete requests are forwarded to Tauri");

console.log("tauri media storage tests passed");
