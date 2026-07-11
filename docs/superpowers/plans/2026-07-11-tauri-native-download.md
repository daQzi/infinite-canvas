# Tauri Native Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every desktop download open a native Save As dialog and write the selected image, video, audio, or ZIP file while preserving browser downloads.

**Architecture:** A shared frontend service routes browser downloads to `file-saver` and Tauri downloads to one Rust command. The Rust backend owns the native dialog, validates sources, reads internal media or remote URLs, and writes only to the dialog-selected path; a shared React hook owns success and error messages.

**Tech Stack:** React 19, TypeScript 5, Tauri 2.11, Rust, `tauri-plugin-dialog`, `reqwest`, `file-saver`, Node assert tests through `tsx`.

## Global Constraints

- Web/Docker downloads must continue to use `file-saver`.
- Tauri downloads must use the system Save As dialog.
- Only `http` and `https` remote sources are accepted by Rust.
- The frontend must never provide an arbitrary destination path.
- Dialog cancellation must be silent; success and failures must show Chinese messages.
- Prefer an internal `storageKey` over a Blob URL whenever both are available.

---

### Task 1: Rust native download backend

**Files:**
- Create: `src-tauri/src/backend/download.rs`
- Modify: `src-tauri/src/backend/mod.rs`
- Modify: `src-tauri/src/backend/http.rs`
- Modify: `src-tauri/src/backend/media.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

**Interfaces:**
- Consumes: `HttpClient::download(&str) -> Result<Vec<u8>, String>` and `media::read_media_bytes(&AppHandle, &str) -> Result<Vec<u8>, String>`.
- Produces: Tauri command `tauri_save_file(payload)` returning `{ status: "saved", path }` or `{ status: "cancelled", path: null }`.

- [ ] **Step 1: Add Rust unit tests for source validation and suggested names**

Add tests in `download.rs` that assert `safe_file_name("../bad:name?.png") == ".._bad_name_.png"`, blank names become `download`, HTTP/HTTPS URLs pass, and `file:` URLs fail.

- [ ] **Step 2: Run the Rust test and confirm it fails before implementation**

Run: `cargo test --manifest-path src-tauri/Cargo.toml backend::download::tests`

Expected: FAIL because `download.rs` and its helpers do not exist. If Cargo is unavailable locally, record that limitation and continue with source review plus GitHub Actions compilation.

- [ ] **Step 3: Implement the command and shared backend readers**

Implement these payloads in `download.rs`:

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFilePayload {
    file_name: String,
    source: DownloadSource,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum DownloadSource {
    Url { url: String },
    Storage { storage_key: String },
    Base64 { body_base64: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileResponse {
    status: &'static str,
    path: Option<String>,
}
```

Implement `tauri_save_file` as an async command that opens `app.dialog().file().set_file_name(...).blocking_save_file()`, returns `cancelled` when no path is selected, resolves one of the three sources, writes with `std::fs::write`, and returns the displayed path. Add `tauri-plugin-dialog = "2.6.0"`, initialize it in `lib.rs`, register the command, and expose only the narrow HTTP/media helper methods needed by this module.

- [ ] **Step 4: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml backend::download::tests`

Expected: PASS for filename and URL validation tests, or the previously recorded local Cargo limitation.

- [ ] **Step 5: Commit the Rust backend**

```bash
git add src-tauri/Cargo.toml src-tauri/src/backend src-tauri/src/lib.rs
git commit -m "feat: add native Tauri file saving"
```

### Task 2: Shared frontend download service and hook

**Files:**
- Create: `web/src/services/file-download.ts`
- Create: `web/src/hooks/use-file-download.ts`
- Create: `web/tests/file-download.test.ts`

**Interfaces:**
- Produces: `saveFile(source: DownloadSource, fileName: string): Promise<DownloadResult>`.
- Produces: `useFileDownload(): (source: DownloadSource, fileName: string) => Promise<DownloadResult | undefined>`.
- `DownloadSource` is `{ kind: "url"; url: string; storageKey?: string } | { kind: "blob"; blob: Blob }`.

- [ ] **Step 1: Write the failing frontend routing test**

Create `web/tests/file-download.test.ts` with a mocked `window.__TAURI_INTERNALS__.invoke`. Assert that:

```ts
await saveFile({ kind: "url", url: "blob:test", storageKey: "image:1" }, "image.png");
assert.deepEqual(received.payload.source, { kind: "storage", storageKey: "image:1" });

await saveFile({ kind: "url", url: "https://example.com/video.mp4" }, "video.mp4");
assert.deepEqual(received.payload.source, { kind: "url", url: "https://example.com/video.mp4" });

await saveFile({ kind: "blob", blob: new Blob(["zip"]) }, "canvas.zip");
assert.equal(received.payload.source.kind, "base64");
assert.equal(Buffer.from(received.payload.source.bodyBase64, "base64").toString(), "zip");
```

- [ ] **Step 2: Run the frontend test and confirm it fails**

Run: `npx --yes tsx@latest --tsconfig web/tsconfig.json web/tests/file-download.test.ts`

Expected: FAIL because `file-download.ts` does not exist.

- [ ] **Step 3: Implement runtime routing and user feedback**

In `file-download.ts`, call `saveAs` for Web/Docker. In Tauri, prefer `storageKey`, pass HTTP/HTTPS directly, and convert Blob/Data/Blob URLs to Base64 with existing helpers before invoking `tauri_save_file`.

In `use-file-download.ts`, wrap `saveFile` with `App.useApp()`: show `文件已保存` for `saved`, show the thrown Chinese error for failures, and return without a message for `cancelled`.

- [ ] **Step 4: Run frontend service tests and type checking**

Run: `npx --yes tsx@latest --tsconfig web/tsconfig.json web/tests/file-download.test.ts`

Expected: `file download tests passed`.

Run: `npm run typecheck` from `web/`.

Expected: exit code 0.

- [ ] **Step 5: Commit the shared frontend capability**

```bash
git add web/src/services/file-download.ts web/src/hooks/use-file-download.ts web/tests/file-download.test.ts
git commit -m "feat: route desktop downloads through Tauri"
```

### Task 3: Migrate media download entry points

**Files:**
- Modify: `web/src/pages/image/index.tsx`
- Modify: `web/src/pages/video/index.tsx`
- Modify: `web/src/pages/assets/index.tsx`
- Modify: `web/src/pages/canvas/project.tsx`

**Interfaces:**
- Consumes: `useFileDownload()` from Task 2.
- Uses URL sources with `storageKey` so Tauri can read internal media and Web can retain its existing URL download.

- [ ] **Step 1: Replace image and video workbench calls**

Remove `file-saver` imports. Call:

```ts
void downloadFile({ kind: "url", url: image.dataUrl, storageKey: image.storageKey }, `image-${index + 1}.png`);
void downloadFile({ kind: "url", url: video.url, storageKey: video.storageKey }, "video.mp4");
```

- [ ] **Step 2: Replace asset and canvas node calls**

For image/video assets, pass the displayed URL and optional `storageKey`. For canvas image/video/audio nodes, pass `node.metadata.content` plus `node.metadata.storageKey`, preserving the existing MIME-derived extension.

- [ ] **Step 3: Run type checking**

Run: `npm run typecheck` from `web/`.

Expected: exit code 0 with no callback return-type errors.

- [ ] **Step 4: Commit migrated media downloads**

```bash
git add web/src/pages/image/index.tsx web/src/pages/video/index.tsx web/src/pages/assets/index.tsx web/src/pages/canvas/project.tsx
git commit -m "fix: use native downloads for desktop media"
```

### Task 4: Migrate ZIP exports and document verification

**Files:**
- Modify: `web/src/pages/assets/asset-transfer.ts`
- Modify: `web/src/pages/assets/index.tsx`
- Modify: `web/src/lib/canvas/canvas-export.ts`
- Modify: `web/src/pages/canvas/index.tsx`
- Modify: `web/src/components/canvas/canvas-project-card.tsx`
- Modify: `CHANGELOG.md`
- Modify: `docs/content/docs/progress/pending-test.mdx`

**Interfaces:**
- `createAssetPackage(assets: Asset[]): Promise<Blob>` returns the ZIP without saving it.
- `createCanvasProjectPackage(projects: CanvasProject[]): Promise<Blob>` returns the ZIP without saving it.
- UI callers consume those blobs through `useFileDownload()`.

- [ ] **Step 1: Make ZIP builders pure**

Rename `exportAssets` to `createAssetPackage` and `exportCanvasProjects` to `createCanvasProjectPackage`. Return the `createZip(...)` result instead of calling `saveAs`.

- [ ] **Step 2: Save ZIPs through the shared hook**

Update the assets page, canvas page, and project card to await the builder and call:

```ts
await downloadFile({ kind: "blob", blob: zip }, "我的素材.zip");
await downloadFile({ kind: "blob", blob: zip }, `${safeFileName(fileName)}.zip`);
```

Export `safeCanvasExportFileName(value: string)` from `canvas-export.ts` so both canvas UI callers preserve the existing filename sanitation.

- [ ] **Step 3: Update user-facing change records**

Add one `Unreleased` changelog entry stating that Tauri media and ZIP downloads now use the native Save As dialog. Add one pending-test entry covering macOS/Windows save, cancel, and file-open verification. The existing follow-up-items list remains unchanged because this bug was not listed there.

- [ ] **Step 4: Run focused and aggregate verification**

Run: `rg -n "saveAs\\(" web/src`

Expected: only `web/src/services/file-download.ts` contains `saveAs(`.

Run: `npx --yes tsx@latest --tsconfig web/tsconfig.json web/tests/file-download.test.ts`

Expected: `file download tests passed`.

Run: `npm run typecheck` and `npm run build:tauri` from `web/`.

Expected: both commands exit 0; existing Vite chunk-size warnings are acceptable.

Run: `git diff --check`.

Expected: exit code 0.

- [ ] **Step 5: Commit ZIP migration and docs**

```bash
git add web/src/pages/assets web/src/lib/canvas/canvas-export.ts web/src/pages/canvas/index.tsx web/src/components/canvas/canvas-project-card.tsx CHANGELOG.md docs/content/docs/progress/pending-test.mdx
git commit -m "fix: support native desktop export downloads"
```
