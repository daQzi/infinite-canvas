# Tauri 桌面应用打包

Tauri 版本会复用 `web/` 的 Vite 静态产物，并在打包前执行：

```bash
cd web
bun install --frozen-lockfile
VITE_BASE=./ bun run build
```

## 本地打包

本机需要先安装 Rust 工具链和 Tauri 对应系统依赖。

```bash
cd /path/to/infinite-canvas
npx --yes @tauri-apps/cli@2.11.4 build
```

产物会输出到 `src-tauri/target/release/bundle/`。

## GitHub Actions

`.github/workflows/tauri-builds.yml` 支持手动触发，也会在推送 `v*` tag 时自动构建：

- macOS：`.dmg`
- Windows：NSIS `.exe`
- Linux：`.AppImage`、`.deb`

tag 触发时会把产物上传到对应 GitHub Release。当前未配置代码签名，正式分发前建议补充 macOS notarization 和 Windows 代码签名。
