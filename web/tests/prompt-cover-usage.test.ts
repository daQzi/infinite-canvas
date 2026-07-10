import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const detailDialogSource = readFileSync(new URL("../src/pages/prompts/components/prompt-detail-dialog.tsx", import.meta.url), "utf8");

assert.match(detailDialogSource, /<PromptCover\s+coverUrl=\{prompt\.coverUrl\}/, "提示词详情弹窗应复用统一封面组件");
assert.doesNotMatch(detailDialogSource, /<img\s+src=\{prompt\.coverUrl\}/, "提示词详情弹窗不应把原始封面地址直接传给 img");

console.log("prompt cover usage tests passed");
