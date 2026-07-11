import saveAs from "file-saver";

import { blobToBase64, invokeTauri, isTauriRuntime } from "@/services/tauri-backend";

export type DownloadSource = { kind: "url"; url: string; storageKey?: string } | { kind: "blob"; blob: Blob };
export type DownloadResult = { status: "saved"; path?: string } | { status: "cancelled"; path?: null };

type TauriDownloadSource = { kind: "url"; url: string } | { kind: "storage"; storageKey: string } | { kind: "base64"; bodyBase64: string };

export async function saveFile(source: DownloadSource, fileName: string): Promise<DownloadResult> {
    if (!isTauriRuntime()) {
        saveAs(source.kind === "blob" ? source.blob : source.url, fileName);
        return { status: "saved" };
    }

    return invokeTauri<DownloadResult>("tauri_save_file", {
        payload: {
            fileName,
            source: await tauriDownloadSource(source),
        },
    });
}

async function tauriDownloadSource(source: DownloadSource): Promise<TauriDownloadSource> {
    if (source.kind === "blob") return { kind: "base64", bodyBase64: await blobToBase64(source.blob) };
    if (source.storageKey) return { kind: "storage", storageKey: source.storageKey };
    if (/^https?:\/\//i.test(source.url)) return { kind: "url", url: source.url };

    try {
        const response = await fetch(source.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { kind: "base64", bodyBase64: await blobToBase64(await response.blob()) };
    } catch (error) {
        throw new Error(`读取下载文件失败：${error instanceof Error ? error.message : String(error)}`);
    }
}
