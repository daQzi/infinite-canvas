# 桌面应用打包

桌面端使用 Electron 包裹 `web/dist` 静态产物，安装包由 `electron-builder` 生成。

## 本地打包

先构建前端：

```bash
cd web
npm install --legacy-peer-deps --no-package-lock
VITE_BASE=./ npm run build
```

再构建桌面端：

```bash
cd ../desktop
npm install
npm run dist
```

产物会输出到 `desktop/release/`。当前配置会在本机系统上生成对应平台的包：

- macOS：`.dmg`、`.zip`
- Windows：NSIS `.exe`、portable `.exe`
- Linux：`.AppImage`、`.deb`

## GitHub Actions

`.github/workflows/desktop-builds.yml` 支持手动触发，也会在推送 `v*` tag 时自动构建 macOS、Windows 和 Linux 包。tag 触发时会把产物上传到对应 GitHub Release。

默认未配置代码签名：

- macOS 包可以构建，但未签名和未 notarize 时下载运行会出现系统安全提示。
- Windows 包可以构建，但未签名时会出现 SmartScreen 提示。

正式分发前建议分别配置 Apple Developer 证书、notarization 信息和 Windows 代码签名证书。
