import localforage from "localforage";

import { nanoid } from "nanoid";
import { readImageMeta } from "@/lib/image-utils";
import { httpFetch } from "@/services/api/http-client";
import { cleanupTauriMediaBlobs, deleteTauriMediaBlobs, readTauriMediaBlob, storeTauriMediaBlob } from "@/services/tauri-media-storage";
import { isTauriRuntime } from "@/services/tauri-backend";

export type UploadedImage = {
    url: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

const store = localforage.createInstance({ name: "infinite-canvas", storeName: "image_files" });
const objectUrls = new Map<string, string>();

export async function uploadImage(input: string | Blob): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await (await httpFetch(input)).blob() : input;
    const storageKey = `image:${nanoid()}`;
    if (isTauriRuntime()) {
        await storeTauriMediaBlob(storageKey, blob, "image");
    } else {
        await store.setItem(storageKey, blob);
    }
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    const meta = await readImageMeta(url);
    return { url, storageKey, width: meta.width, height: meta.height, bytes: blob.size, mimeType: blob.type || meta.mimeType };
}

export async function resolveImageUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    const cached = objectUrls.get(storageKey);
    if (cached) return cached;
    const blob = isTauriRuntime() ? await readTauriMediaBlob(storageKey) : await store.getItem<Blob>(storageKey);
    if (!blob) return fallback;
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function getImageBlob(storageKey: string) {
    if (isTauriRuntime()) return readTauriMediaBlob(storageKey);
    return store.getItem<Blob>(storageKey);
}

export async function setImageBlob(storageKey: string, blob: Blob) {
    if (isTauriRuntime()) {
        await storeTauriMediaBlob(storageKey, blob, "image");
    } else {
        await store.setItem(storageKey, blob);
    }
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function imageToDataUrl(image: { url?: string; dataUrl?: string; storageKey?: string }) {
    const url = image.dataUrl || (await resolveImageUrl(image.storageKey, image.url || ""));
    if (!url || url.startsWith("data:")) return url;
    return blobToDataUrl(await (await httpFetch(url)).blob());
}

export async function deleteStoredImages(keys: Iterable<string>) {
    const storageKeys = Array.from(new Set(keys));
    storageKeys.forEach((key) => {
        const url = objectUrls.get(key);
        if (url) URL.revokeObjectURL(url);
        objectUrls.delete(key);
    });
    if (await deleteTauriMediaBlobs(storageKeys)) return;
    await Promise.all(
        storageKeys.map(async (key) => {
            await store.removeItem(key);
        }),
    );
}

export async function cleanupUnusedImages(usedData: unknown) {
    const usedKeys = collectImageStorageKeys(usedData);
    const deletedKeys = await cleanupTauriMediaBlobs(usedKeys, ["image:"]);
    if (deletedKeys) {
        deletedKeys.forEach((key) => {
            const url = objectUrls.get(key);
            if (url) URL.revokeObjectURL(url);
            objectUrls.delete(key);
        });
        return;
    }
    const unused: string[] = [];
    await store.iterate((_value, key) => {
        if (!usedKeys.has(key)) unused.push(key);
    });
    await deleteStoredImages(unused);
}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.startsWith("image:")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectImageStorageKeys(child, keys)) : collectImageStorageKeys(item, keys)));
    return keys;
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}
