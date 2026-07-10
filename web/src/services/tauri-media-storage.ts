import { base64ToBlob, blobToBase64, invokeTauri, isTauriRuntime } from "@/services/tauri-backend";

type StoreMediaFileResponse = {
    storageKey: string;
    bytes: number;
    mimeType: string;
};

type ReadMediaFileResponse = {
    bodyBase64: string;
    mimeType: string;
    bytes: number;
} | null;

export async function storeTauriMediaBlob(storageKey: string, blob: Blob, prefix = "file") {
    if (!isTauriRuntime()) return null;
    return invokeTauri<StoreMediaFileResponse>("tauri_store_media_file", {
        payload: {
            storageKey,
            prefix,
            mimeType: blob.type || "application/octet-stream",
            bodyBase64: await blobToBase64(blob),
        },
    });
}

export async function readTauriMediaBlob(storageKey: string) {
    if (!isTauriRuntime()) return null;
    const response = await invokeTauri<ReadMediaFileResponse>("tauri_read_media_file", {
        payload: { storageKey },
    });
    return response ? base64ToBlob(response.bodyBase64, response.mimeType) : null;
}

export async function deleteTauriMediaBlobs(storageKeys: Iterable<string>) {
    if (!isTauriRuntime()) return false;
    await invokeTauri("tauri_delete_media_files", {
        payload: { storageKeys: Array.from(new Set(storageKeys)) },
    });
    return true;
}

export async function cleanupTauriMediaBlobs(usedStorageKeys: Iterable<string>, prefixes: string[]) {
    if (!isTauriRuntime()) return null;
    return invokeTauri<string[]>("tauri_cleanup_media_files", {
        payload: {
            usedStorageKeys: Array.from(new Set(usedStorageKeys)),
            prefixes,
        },
    });
}
