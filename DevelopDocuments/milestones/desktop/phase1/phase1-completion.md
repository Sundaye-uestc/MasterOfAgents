# Desktop Phase 1 开发完成文档

**完成日期：** 2026-06-07

> **最后更新：** 2026-06-07 — Electron Shell + Server Lifecycle 全部完成

---

## 概述

Phase 1 实现桌面端基础架构：Electron 窗口管理、开发模式启动器、本地服务端子进程生命周期管理。

- **项目结构**：monorepo 内 `apps/desktop/`，与 web/server/mobile 平级，复用 `apps/web` + 内置 `apps/server`
- **双进程架构**：Main Process（Electron）管理窗口和子进程，Renderer Process 加载 Web UI
- **Server 生命周期**：Main Process 通过 `child_process.spawn` 启动/停止 `apps/server`，自动检测可用端口

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 说明 |
|---|---|
| `apps/desktop/package.json` | `@agenthub/desktop`，Electron 33，electron-builder 25 |
| `apps/desktop/tsconfig.json` | TypeScript 编译配置，ES2022 + Node16 |
| `apps/desktop/electron-builder.yml` | 打包配置：dir 目标、asarUnpack、extraResources（server + web）|
| `apps/desktop/src/main/index.ts` | Electron 主进程入口：app 生命周期、BrowserWindow、server 启停 |
| `apps/desktop/src/main/preload.ts` | contextBridge + ipcRenderer 安全 API 暴露 |
| `apps/desktop/src/main/server-lifecycle.ts` | Server 子进程管理：端口探测、spawn、stdout/stderr 管道、graceful shutdown |
| `apps/desktop/src/main/proxy-server.ts` | 生产模式代理服务器：静态文件服务 + API 反向代理 |
| `apps/desktop/scripts/electron-dev.js` | 开发模式 wrapper：清除 ELECTRON_RUN_AS_NODE 后启动 Electron |

### 1.2 修改文件

| 文件 | 说明 |
|---|---|
| `apps/server/src/app.ts` | 添加 `hostname: "127.0.0.1"` 到 serve() 调用，修复 IPv6 端口冲突 |

---

## 二、Electron Shell（Step 1）

### 2.1 应用生命周期

```ts
// src/main/index.ts 核心逻辑
app.whenReady() → registerIpcHandlers() → createMainWindow()
  ├─ startServer(SERVER_DIR)   → 子进程启动 server
  ├─ startProxyServer(WEB_DIR) → 生产模式代理
  └─ new BrowserWindow({ webPreferences: { preload, contextIsolation, sandbox } })
       └─ win.loadURL(uiUrl)   → dev: http://localhost:5173 / prod: proxy
```

- **窗口配置**：1280×800，最低 900×600，标题 "AgentHub"
- **安全策略**：`contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`
- **关闭行为**：`window-all-closed` → 停止所有服务 → `app.quit()`（MVP "关闭即停止"）
- **重新打开**（macOS）：`activate` → 无窗口时重建
- **appUserModelId**：`com.agenthub.desktop`（Windows 通知分组）

### 2.2 开发模式 wrapper

**问题**：Claude Code / VSCode 终端设置 `ELECTRON_RUN_AS_NODE=1`，导致 `require("electron")` 返回路径字符串而非 Electron API。

**解决**：`scripts/electron-dev.js` — 在子进程中 `delete process.env.ELECTRON_RUN_AS_NODE` 后 spawn 真实的 Electron 进程。

---

## 三、Server Lifecycle（Step 2）

### 3.1 端口探测

```ts
detectFreePort(3001) → isPortFree(port)
  ├─ IPv4: net.createServer().listen(port, "127.0.0.1")
  └─ IPv6: net.createServer().listen(port, "::1")  // 二次检测
```

- 从 3001 开始扫描，最多扫描 100 个端口
- 同时检测 IPv4 和 IPv6 loopback，防止 EADDRINUSE

### 3.2 子进程管理

| 模式 | 命令 | cwd |
|------|------|-----|
| 开发 | `npx tsx src/index.ts` | `apps/server/` |
| 生产 | `node index.js` | `resources/server/` |

- **stdout 解析**：检测 `REST http://localhost:<port>` 行，resolve Promise
- **stderr 透传**：写入主进程 stderr
- **超时保护**：30 秒未 ready → kill 子进程 + reject
- **SIGTERM** → 5 秒后 SIGKILL 兜底

### 3.3 Packaged 模式 ESM 解析

**问题**：`app.asar.unpacked/node_modules/` 在 Electron 的 asar fs patch 之外，server 子进程（纯 Node.js）无法访问。

**解决**：`ensureServerNodeModules()` 在 `resources/server/` 下创建 directory junction → `resources/app.asar.unpacked/node_modules/`

```ts
fs.symlinkSync(nodeModulesPath, serverNodeModules, "junction");
```

Junction 需要 Windows 管理员权限或开发者模式；build script 在打包阶段预创建。

---

## 四、关键架构决策

| 决策 | 说明 |
|---|---|
| 双进程架构 | Main Process 管理 Electron + 子进程；Renderer 通过 preload IPC 通信 |
| 端口探测（IPv4+IPv6） | 同时检测两个地址族，避免 server 绑定 `::` 而检测只查 `127.0.0.1` |
| Junction 桥接 | Windows directory junction 连接 ESM 模块路径，build script 预创建 |
| 开发模式 wrapper | 独立 js 脚本清除 ELECTRON_RUN_AS_NODE，不依赖 Py 脚本 |
| `windowsHide: true` | 生产模式隐藏 server 子进程的控制台窗口 |
| `shell: true`（Windows） | 确保 cmd.exe 正确处理 PATH 和进程创建 |

---

## 五、验证结果

| 验证项 | 状态 |
|---|---|
| `pnpm --filter @agenthub/desktop build` TypeScript 编译通过 | ✅ |
| `pnpm dev` → Electron 窗口启动，加载 Web UI | ✅ |
| 开发模式自动检测 ELECTRON_RUN_AS_NODE 并清除 | ✅ |
| Server 子进程自动检测空闲端口（从 3001 开始） | ✅ |
| IPv4 + IPv6 双栈端口检测 | ✅ |
| `REST http://localhost:<port>` 信号 → Promise resolve | ✅ |
| Server 启动超时（30s）自动 kill | ✅ |
| `stopServer()` → SIGTERM → SIGKILL（5s 超时）| ✅ |
| 窗口关闭 → 自动停止所有服务 | ✅ |
| Packaged 模式 junction 创建（ESM 解析）| ✅ |
| `NODE_PATH` 设置（CJS 依赖兜底）| ✅ |

---

## 六、Git 提交记录

| Commit | 说明 |
|---|---|
| `ac817f7` | Docs: desktop system design + module design + development todo |
| (部分未提交) | Feat: Electron shell + server lifecycle + dev wrapper |
