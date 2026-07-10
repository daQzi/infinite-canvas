# Remove Electron And Add Prompt Cover Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除全部 Electron 桌面架构，并让无封面或封面加载失败的提示词显示统一占位内容。

**Architecture:** 桌面端只保留既有 Tauri 目录和 workflow。前端新增一个展示层 `PromptCover` 组件，集中处理 URL 规范化、图片加载失败和无封面占位；首页另外过滤 Ant Design 图片预览数据，确保预览组件不接收空地址。

**Tech Stack:** Vite、React 19、TypeScript、Ant Design、Tailwind CSS、lucide-react、Node assert、tsx。

## Global Constraints

- 完整删除 Electron 源码、依赖、构建产物和 workflow，不保留兼容桥接。
- 保留 `src-tauri/`、`.github/workflows/tauri-builds.yml` 和 `.github/workflows/release.yml` 的 Tauri 构建逻辑。
- 不修改 `Prompt` 数据结构和提示词缓存格式。
- 页面文案使用中文，占位内容同时适配浅色和深色主题。
- 不执行构建和类型检查；只运行定向测试、既有轻量测试及浏览器检查。

---

### Task 1: 提示词封面组件

**Files:**
- Create: `web/src/components/prompts/prompt-cover.tsx`
- Test: `web/tests/prompt-cover.test.tsx`

**Interfaces:**
- Produces: `hasPromptCover(coverUrl: string): boolean`
- Produces: `PromptCover({ coverUrl, alt, className, imageClassName }): JSX.Element`

- [ ] **Step 1: 编写失败测试**

```tsx
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { hasPromptCover, PromptCover } from "../src/components/prompts/prompt-cover.tsx";

assert.equal(hasPromptCover(""), false, "空封面地址应显示占位内容");
assert.equal(hasPromptCover("   "), false, "纯空白封面地址应显示占位内容");
assert.equal(hasPromptCover("https://example.com/cover.png"), true, "有效封面地址应显示图片");

const placeholder = renderToStaticMarkup(<PromptCover coverUrl="" alt="测试提示词" className="aspect-[4/3]" />);
assert.match(placeholder, /暂无封面/, "无封面时应渲染中文占位文案");
assert.doesNotMatch(placeholder, /src=/, "无封面时不应渲染空图片地址");

const image = renderToStaticMarkup(<PromptCover coverUrl=" https://example.com/cover.png " alt="测试提示词" />);
assert.match(image, /src="https:\/\/example.com\/cover.png"/, "有效封面地址应去除首尾空白后渲染");

console.log("prompt cover tests passed");
```

- [ ] **Step 2: 运行测试并确认因组件不存在而失败**

Run: `npx --yes tsx --tsconfig web/tsconfig.json --test web/tests/prompt-cover.test.tsx`

Expected: FAIL，错误包含找不到 `prompt-cover.tsx`。

- [ ] **Step 3: 实现最小封面组件**

```tsx
import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function hasPromptCover(coverUrl: string) {
    return Boolean(coverUrl.trim());
}

export function PromptCover({ coverUrl, alt, className, imageClassName }: { coverUrl: string; alt: string; className?: string; imageClassName?: string }) {
    const normalizedCoverUrl = coverUrl.trim();
    const [failedCoverUrl, setFailedCoverUrl] = useState("");
    const showPlaceholder = !hasPromptCover(normalizedCoverUrl) || failedCoverUrl === normalizedCoverUrl;

    if (showPlaceholder) {
        return (
            <div role="img" aria-label={`${alt}：暂无封面`} className={cn("flex flex-col items-center justify-center gap-2 bg-stone-100 text-stone-400 dark:bg-stone-900 dark:text-stone-500", className)}>
                <ImageIcon aria-hidden="true" className="size-8" strokeWidth={1.5} />
                <span className="text-xs">暂无封面</span>
            </div>
        );
    }

    return <img src={normalizedCoverUrl} alt={alt} className={cn("object-cover", className, imageClassName)} onError={() => setFailedCoverUrl(normalizedCoverUrl)} />;
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `npx --yes tsx --tsconfig web/tsconfig.json --test web/tests/prompt-cover.test.tsx`

Expected: PASS，输出 `prompt cover tests passed`。

- [ ] **Step 5: 提交组件和测试**

```bash
git add web/src/components/prompts/prompt-cover.tsx web/tests/prompt-cover.test.tsx
git commit -m "fix: add prompt cover fallback"
```

### Task 2: 接入提示词展示入口

**Files:**
- Modify: `web/src/components/prompts/prompt-card.tsx`
- Modify: `web/src/pages/home/index.tsx`

**Interfaces:**
- Consumes: `PromptCover` 和 `hasPromptCover` from `web/src/components/prompts/prompt-cover.tsx`

- [ ] **Step 1: 提示词卡片统一使用封面组件**

在 `prompt-card.tsx` 引入 `PromptCover`，把原 `<img>` 替换为：

```tsx
<PromptCover coverUrl={item.coverUrl} alt={item.title} className="aspect-[4/3] w-full" />
```

- [ ] **Step 2: 首页统一使用封面组件并建立有效预览列表**

在 `home/index.tsx` 引入 `PromptCover`、`hasPromptCover`，并在状态后派生：

```tsx
const previewPrompts = promptShowcase.filter((item) => hasPromptCover(item.coverUrl));
```

首页网格图片替换为：

```tsx
<PromptCover
    coverUrl={item.coverUrl}
    alt={item.title}
    className="h-full w-full"
    imageClassName="transition duration-500 group-hover:scale-[1.03]"
/>
```

点击时按 ID 查找有效预览索引；没有封面的项目保持卡片展示但不打开空预览：

```tsx
const nextPreviewIndex = previewPrompts.findIndex((previewItem) => previewItem.id === item.id);
if (nextPreviewIndex < 0) return;
setPreviewIndex(nextPreviewIndex);
setPreviewOpen(true);
```

隐藏预览列表改为遍历 `previewPrompts`，并传入去除首尾空白后的地址：

```tsx
{previewPrompts.map((item) => (
    <Image key={item.id} src={item.coverUrl.trim()} alt={item.title} />
))}
```

- [ ] **Step 3: 运行封面测试**

Run: `npx --yes tsx --tsconfig web/tsconfig.json --test web/tests/prompt-cover.test.tsx`

Expected: PASS。

- [ ] **Step 4: 提交入口接入**

```bash
git add web/src/components/prompts/prompt-card.tsx web/src/pages/home/index.tsx
git commit -m "fix: use prompt cover fallback across views"
```

### Task 3: 移除 Electron 架构并同步文档

**Files:**
- Delete: `desktop/`
- Delete: `.github/workflows/desktop-builds.yml`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/content/docs/progress/pending-test.mdx`
- Check only: `docs/content/docs/progress/todo.mdx`

**Interfaces:**
- Preserves: Tauri source and workflows without modification.

- [ ] **Step 1: 删除 Electron 源码、依赖、产物和 workflow**

```bash
git rm -r desktop .github/workflows/desktop-builds.yml
rm -rf desktop
```

- [ ] **Step 2: 更新 README 桌面说明**

将“两套桌面端打包配置”改为：

```markdown
项目使用 Tauri 提供桌面端打包配置，详见 [src-tauri/README.md](src-tauri/README.md)。
```

- [ ] **Step 3: 更新当前变更记录**

在 `CHANGELOG.md` 的 `Unreleased` 下增加：

```markdown
+ [调整] 移除 Electron 桌面壳和构建流程，桌面端统一使用 Tauri。
+ [修复] 提示词缺少封面或封面加载失败时显示占位内容，避免空图片地址错误。
```

在 `pending-test.mdx` 删除 Electron 桌面构建验证项，并把 GitHub Actions 验证项中的 `Desktop` 删除；增加：

```markdown
- 提示词封面：提示词缺少封面或远程封面加载失败时显示“暂无封面”，需验证首页、提示词库和提示词选择弹窗不会出现空图片地址或布局跳动。
```

- [ ] **Step 4: 确认 TODO 无对应状态变化**

读取 `docs/content/docs/progress/todo.mdx`，确认唯一的 Claude Agent SDK 待办与本次无关，不修改该文件。

- [ ] **Step 5: 验证 Electron 清理和 Tauri 保留**

Run: `test ! -e desktop`

Expected: exit 0。

Run: `test ! -e .github/workflows/desktop-builds.yml`

Expected: exit 0。

Run: `rg -n -i "electron|desktop-builds|Desktop builds" README.md docs/content/docs/progress/pending-test.mdx .github/workflows`

Expected: 无匹配。

Run: `test -d src-tauri`

Expected: exit 0。

Run: `test -f .github/workflows/tauri-builds.yml`

Expected: exit 0。

Run: `git diff -- src-tauri .github/workflows/tauri-builds.yml .github/workflows/release.yml`

Expected: 无输出。

- [ ] **Step 6: 提交 Electron 清理和文档同步**

```bash
git add README.md CHANGELOG.md docs/content/docs/progress/pending-test.mdx
git commit -m "refactor: remove electron desktop architecture"
```

### Task 4: 回归和浏览器验证

**Files:**
- Verify only: `web/tests/*.test.ts`
- Verify only: `web/tests/prompt-cover.test.tsx`

**Interfaces:**
- Verifies: prompt fallback behavior, existing lightweight tests, desktop architecture boundary, and rendered layouts.

- [ ] **Step 1: 运行全部轻量测试**

Run: `npx --yes tsx --tsconfig web/tsconfig.json --test web/tests/*.test.ts web/tests/*.test.tsx`

Expected: 所有测试通过且没有 React 空 `src` 警告。

- [ ] **Step 2: 检查补丁格式**

Run: `git diff --check HEAD~3..HEAD`

Expected: 无输出。

- [ ] **Step 3: 使用独立开发端口检查页面**

Run: `bun run dev -- --port 4317`

在桌面和移动视口检查首页、提示词库和提示词选择弹窗。有效封面保持原比例；空封面显示固定尺寸占位内容；页面无重叠、布局空洞和空 `src` 控制台错误。

- [ ] **Step 4: 检查最终状态**

Run: `git status --short --branch`

Expected: 仅实施计划文档可能尚未提交；没有意外文件。
