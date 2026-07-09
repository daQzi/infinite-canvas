import { app, BrowserWindow, net, protocol, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_SCHEME = "app";
const APP_HOST = "infinite-canvas";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function webRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "web");
  return path.resolve(__dirname, "../../web/dist");
}

function resolveAppFile(url) {
  const root = webRoot();
  const parsed = new URL(url);
  const requestPath = decodeURIComponent(parsed.pathname || "/");
  const relativePath = requestPath.replace(/^\/+/, "") || "index.html";
  const candidate = path.resolve(root, relativePath);
  const candidateIsInsideRoot = !path.relative(root, candidate).startsWith("..");

  if (candidateIsInsideRoot && existsSync(candidate)) return candidate;
  return path.join(root, "index.html");
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const fileUrl = pathToFileURL(resolveAppFile(request.url)).toString();
    return net.fetch(fileUrl);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title: "无限画布",
    backgroundColor: "#0f1117",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${APP_SCHEME}://${APP_HOST}`)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  void win.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
}

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
