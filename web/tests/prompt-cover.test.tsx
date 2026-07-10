import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { hasPromptCover, PromptCover } from "../src/components/prompts/prompt-cover.tsx";

assert.equal(hasPromptCover(""), false, "空封面地址应显示占位内容");
assert.equal(hasPromptCover("   "), false, "纯空白封面地址应显示占位内容");
assert.equal(hasPromptCover("https://example.com/cover.png"), true, "有效封面地址应显示图片");

const placeholder = renderToStaticMarkup(createElement(PromptCover, { coverUrl: "", alt: "测试提示词", className: "aspect-[4/3]" }));
assert.match(placeholder, /暂无封面/, "无封面时应渲染中文占位文案");
assert.doesNotMatch(placeholder, /src=/, "无封面时不应渲染空图片地址");

const image = renderToStaticMarkup(createElement(PromptCover, { coverUrl: " https://example.com/cover.png ", alt: "测试提示词" }));
assert.match(image, /src="https:\/\/example.com\/cover.png"/, "有效封面地址应去除首尾空白后渲染");

console.log("prompt cover tests passed");
