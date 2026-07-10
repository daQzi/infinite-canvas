import { base64ToBytes, bytesToBase64, getTauriInvoke, isTauriRuntime } from "@/services/tauri-backend";

type HttpResponseType = "json" | "blob" | "text";
type HttpBody = BodyInit | Record<string, unknown> | unknown[] | null | undefined;

export { isTauriRuntime };

type TauriHttpResponse = {
    status: number;
    headers: Record<string, string>;
    bodyBase64: string;
};

export type HttpRequestOptions = {
    headers?: HeadersInit;
    responseType?: HttpResponseType;
    signal?: AbortSignal;
};

export type HttpResponse<T> = {
    data: T;
    status: number;
    headers: Record<string, string>;
};

export class HttpRequestError<T = unknown> extends Error {
    isAxiosError = true;
    response?: HttpResponse<T>;
    status?: number;

    constructor(message: string, response?: HttpResponse<T>) {
        super(message);
        this.name = "AxiosError";
        this.response = response;
        this.status = response?.status;
    }

    toJSON() {
        return {
            message: this.message,
            name: this.name,
            status: this.status,
        };
    }
}

export async function httpGet<T>(url: string, options: HttpRequestOptions = {}) {
    return httpRequest<T>("GET", url, undefined, options);
}

export async function httpPost<T>(url: string, body?: HttpBody, options: HttpRequestOptions = {}) {
    return httpRequest<T>("POST", url, body, options);
}

export async function httpFetch(url: string, init: RequestInit = {}) {
    if (!isTauriRuntime() || !isHttpUrl(url)) return fetch(url, init);
    return tauriFetch(url, init);
}

async function httpRequest<T>(method: string, url: string, body: HttpBody, options: HttpRequestOptions) {
    const headers = normalizeHeaders(options.headers);
    const requestBody = normalizeRequestBody(body, headers);
    const response = await httpFetch(url, {
        method,
        headers,
        body: requestBody,
        signal: options.signal,
    });
    const data = await readResponseData(response, options.responseType || "json");
    const result = { data: data as T, status: response.status, headers: responseHeaders(response.headers) };
    if (!response.ok) throw new HttpRequestError(readErrorMessage(data, response.status), result);
    return result;
}

async function tauriFetch(url: string, init: RequestInit) {
    const invoke = getTauriInvoke();
    if (!invoke) return fetch(url, init);
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const headers = normalizeHeaders(init.headers);
    const bodyBase64 = await serializeBody(init.body, headers);
    const response = await abortable(
        invoke<TauriHttpResponse>("tauri_http_request", {
            payload: {
                method: (init.method || "GET").toUpperCase(),
                url,
                headers,
                bodyBase64,
            },
        }),
        init.signal,
    );

    return new Response(base64ToBytes(response.bodyBase64), {
        status: response.status,
        headers: response.headers,
    });
}

function normalizeRequestBody(body: HttpBody, headers: Record<string, string>): BodyInit | undefined {
    if (body === undefined || body === null) return undefined;
    if (shouldJsonEncode(body)) {
        setHeaderIfMissing(headers, "content-type", "application/json");
        return JSON.stringify(body);
    }
    return body as BodyInit;
}

async function serializeBody(body: BodyInit | null | undefined, headers: Record<string, string>) {
    if (body === undefined || body === null) return undefined;
    if (isReadableStream(body)) throw new Error("Tauri 桌面请求暂不支持流式请求体");

    const request = new Request("https://tauri.local/", { method: "POST", body });
    request.headers.forEach((value, key) => setHeaderIfMissing(headers, key, value));
    return bytesToBase64(new Uint8Array(await request.arrayBuffer()));
}

async function readResponseData(response: Response, responseType: HttpResponseType) {
    if (responseType === "blob") return response.blob();
    const text = await response.text();
    if (responseType === "text") return text;
    if (!text) return undefined;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

function readErrorMessage(data: unknown, status: number) {
    const payload = data as { msg?: unknown; message?: unknown; error?: { message?: unknown } } | undefined;
    const message = readString(payload?.msg) || readString(payload?.message) || readString(payload?.error?.message);
    return message || `请求失败：${status}`;
}

function readString(value: unknown) {
    return typeof value === "string" ? value : "";
}

function responseHeaders(headers: Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
        result[key.toLowerCase()] = value;
    });
    return result;
}

function normalizeHeaders(headers?: HeadersInit) {
    const result: Record<string, string> = {};
    new Headers(headers).forEach((value, key) => {
        result[key.toLowerCase()] = value;
    });
    return result;
}

function setHeaderIfMissing(headers: Record<string, string>, name: string, value: string) {
    const key = name.toLowerCase();
    if (!headers[key]) headers[key] = value;
}

function shouldJsonEncode(value: HttpBody) {
    if (!value || typeof value !== "object") return false;
    return !isBodyInit(value);
}

function isBodyInit(value: object) {
    return value instanceof ArrayBuffer || ArrayBuffer.isView(value) || isInstance(value, "Blob") || isInstance(value, "FormData") || isInstance(value, "URLSearchParams") || isReadableStream(value);
}

function isReadableStream(value: unknown): value is ReadableStream {
    return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

function isInstance(value: object, constructorName: "Blob" | "FormData" | "URLSearchParams") {
    const constructor = globalThis[constructorName];
    return typeof constructor !== "undefined" && value instanceof constructor;
}

function isHttpUrl(url: string) {
    return /^https?:\/\//i.test(url);
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal | null) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    });
}
