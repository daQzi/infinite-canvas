import assert from "node:assert/strict";

import { imageGenerationResultsFromLog } from "../src/lib/image-generation-log";

const failedOnly = imageGenerationResultsFromLog({
    id: "log-failed",
    images: [],
    failCount: 1,
    error: "provider rejected the request",
});

assert.deepEqual(
    failedOnly,
    [{ id: "log-failed-failed-0", status: "failed", error: "provider rejected the request" }],
    "failed-only image logs restore a failed result card",
);

const mixedResults = imageGenerationResultsFromLog({
    id: "log-mixed",
    images: [{ id: "image-1", dataUrl: "data:image/png;base64,a" }],
    failCount: 2,
});

assert.equal(mixedResults.length, 3, "partial failures restore success images and failed result cards");
assert.deepEqual(
    mixedResults.map((result) => result.status),
    ["success", "failed", "failed"],
    "result statuses preserve successful images and failure count",
);

const legacyFailure = imageGenerationResultsFromLog({
    id: "log-legacy",
    images: [],
    status: "失败",
});

assert.deepEqual(legacyFailure, [{ id: "log-legacy-failed-0", status: "failed", error: "生成失败" }], "legacy failed logs without failCount still restore one failed result card");

console.log("image generation log tests passed");
