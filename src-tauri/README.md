# Tauri 桌面应用打包

Tauri 版本会复用 `web/` 的 Vite 静态产物，并在打包前执行：

```bash
cd web
bun install --frozen-lockfile
bun run build:tauri
```

## 本地打包

本机需要先安装 Rust 工具链和 Tauri 对应系统依赖。

```bash
cd /path/to/infinite-canvas
npx --yes @tauri-apps/cli@2.11.4 build
```

产物会输出到 `src-tauri/target/release/bundle/`。

## AI 接口请求

桌面端运行在 Tauri WebView 中，前端直接请求第三方 AI Base URL 时仍会受到浏览器 CORS 限制。Tauri 包现在通过 `tauri_http_request` 命令把 AI 请求交给 Rust 侧 `reqwest` 执行，再把响应回传给前端。

使用时 Base URL 仍填写真实服务地址，例如 `https://example.com/v1`，不需要改成 `localhost` 或 Docker 代理地址。

## GitHub Actions

`.github/workflows/tauri-builds.yml` 支持手动触发，用于下载测试构建产物：

- macOS Apple Silicon：`.dmg`
- macOS Intel：`.dmg`
- Windows：NSIS `.exe`
- Linux：`.AppImage`、`.deb`

正式发布由 `.github/workflows/release.yml` 处理。推送 `v*.*.*` tag 后会先创建草稿 Release，校验 tag、`VERSION` 和 `src-tauri/tauri.conf.json` 版本一致，再分别构建 macOS Apple Silicon、macOS Intel、Windows x64 和 Linux x64 产物，全部成功后发布 Release。

如果已配置 Apple Developer ID 信息，macOS 正式发布会自动签名 / notarization，减少“已损坏”或 Gatekeeper 拦截提示。未配置时也会继续产出未签名 macOS 包，但下载后可能需要用户手动放行。可选 GitHub Secrets：

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
