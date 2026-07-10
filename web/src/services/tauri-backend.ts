export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function isTauriRuntime() {
    return Boolean(getTauriInvoke());
}

export async function invokeTauri<T>(command: string, args?: Record<string, unknown>) {
    const invoke = getTauriInvoke();
    if (!invoke) throw new Error("当前不是 Tauri 运行环境");
    return invoke<T>(command, args);
}

export async function blobToBase64(blob: Blob) {
    return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

export function base64ToBlob(bodyBase64: string, mimeType = "application/octet-stream") {
    return new Blob([base64ToBytes(bodyBase64)], { type: mimeType });
}

export function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

export function base64ToBytes(value: string) {
    const binary = atob(value || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

export function getTauriInvoke(): TauriInvoke | null {
    if (typeof window === "undefined") return null;
    const internals = (window as Window & { __TAURI_INTERNALS__?: { invoke?: TauriInvoke } }).__TAURI_INTERNALS__;
    return typeof internals?.invoke === "function" ? internals.invoke.bind(internals) : null;
}
