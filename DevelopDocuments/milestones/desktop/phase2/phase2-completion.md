# Desktop Phase 2 开发完成文档

**完成日期：** 2026-06-07

> **最后更新：** 2026-06-07 — IPC Bridge + Workspace Selection + CLI Detection 全部完成

---

## 概述

Phase 2 实现桌面端与 Renderer 的完整 IPC 桥接、原生工作区选择器、以及本地 CLI 工具检测。

- **IPC Bridge**：完整的 `ipcMain.handle()` 注册 + `contextBridge` 暴露，覆盖 5 大能力域
- **Workspace Selection**：原生 `dialog.showOpenDialog` 选择文件夹 + 最近路径记忆
- **CLI Detection**：`claude --version` 检测 Claude Code 可用性，简化策略映射所有 Agent 类型

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 说明 |
|---|---|
| `apps/desktop/src/main/ipc-handlers.ts` | 注册全部 IPC handler：workspace、server-status、cli-status、notification、preview-server |
| `apps/desktop/src/main/cli-detection.ts` | Claude Code CLI 可用性检测，简化策略映射 agent 状态 |

### 1.2 已有文件（Phase 1 建立，Phase 2 完善）

| 文件 | 说明 |
|---|---|
| `apps/desktop/src/main/preload.ts` | `contextBridge.exposeInMainWorld("desktopApi", { ... })` |
| `apps/desktop/src/main/index.ts` | `app.whenReady()` → `registerIpcHandlers()` |

---

## 二、IPC Bridge（Step 4）

### 2.1 Handler 注册架构

```ts
// ipc-handlers.ts → registerIpcHandlers()
ipcMain.handle("desktop:select-workspace", async () => { ... })
ipcMain.handle("desktop:get-server-status", () => getServerStatus())
ipcMain.handle("desktop:get-cli-status", () => getAgentAvailability())
ipcMain.handle("desktop:show-notification", (_e, opts) => showNotification(opts))
ipcMain.handle("desktop:start-preview-server", (_e, path, port) => startPreviewServer(path, port))
ipcMain.handle("desktop:stop-preview-server", () => stopPreview())
ipcMain.handle("desktop:get-preview-url", (_e, relativePath) => getPreviewUrl(relativePath))
```

### 2.2 preload.ts 暴露

```ts
contextBridge.exposeInMainWorld("desktopApi", {
  selectWorkspace: () => ipcRenderer.invoke("desktop:select-workspace"),
  getServerStatus: () => ipcRenderer.invoke("desktop:get-server-status"),
  getCliStatus: () => ipcRenderer.invoke("desktop:get-cli-status"),
  showNotification: (opts) => ipcRenderer.invoke("desktop:show-notification", opts),
  startPreviewServer: (path, port?) => ipcRenderer.invoke("desktop:start-preview-server", path, port),
  stopPreviewServer: () => ipcRenderer.invoke("desktop:stop-preview-server"),
  getPreviewUrl: (relativePath) => ipcRenderer.invoke("desktop:get-preview-url", relativePath),
});
```

### 2.3 通信模式

- **Renderer → Main**：`window.desktopApi.xxx()` → `ipcRenderer.invoke()` → `ipcMain.handle()`
- **Main → Renderer**：通过 WebContents（暂不实现，MVP 用 Web UI 层 WebSocket 代替）
- **错误处理**：Main 端 try/catch，异常通过 IPC 传递回 Renderer

---

## 三、Workspace Selection（Step 3）

### 3.1 原生文件夹选择器

```ts
ipcMain.handle("desktop:select-workspace", async () => {
  const recent = loadRecentWorkspace();
  const result = await dialog.showOpenDialog({
    title: "选择工作区",
    properties: ["openDirectory"],
    defaultPath: recent || app.getPath("home"),
  });
  if (result.canceled) return null;
  saveRecentWorkspace(result.filePaths[0]);
  return result.filePaths[0];
});
```

- **标题**："选择工作区"
- **默认路径**：最近使用的 workspace，无历史则用户主目录
- **取消**：返回 `null`

### 3.2 最近路径记忆

- **存储位置**：`app.getPath("userData")/recent-workspace.json`
- **格式**：`{ path: string, updatedAt: number }`
- **容错**：文件损坏/缺失 → 返回 `null`

---

## 四、CLI Detection（Step 5）

### 4.1 检测逻辑

```ts
detectClaudeCode(): Promise<CliStatus> {
  exec("claude --version", { timeout: 10_000 })
    available: true → { available: true, path: "claude", version: stdout }
    available: false → { available: false }
}
```

### 4.2 简化策略

**设计原则**：Claude Code 可用 → 假定开发环境完整 → 所有 Agent（Claude、Codex、OpenCode）标记为可用。

```ts
getAgentAvailability() → {
  claude: claude.available,
  codex: claude.available,   // 跟随 Claude Code 状态
  opencode: claude.available, // 跟随 Claude Code 状态
}
```

---

## 五、关键架构决策

| 决策 | 说明 |
|---|---|
| IPC 全部用 `invoke/handle` | 异步 request-response，与 Electron 最佳实践一致 |
| 不实现 Main→Renderer push | MVP 用 WebSocket 代替，简化架构 |
| Workspace 路径持久化 | `userData` 下 JSON 文件，轻量级，无需 DB |
| CLI 检测简化 | 检测一个 CLI 即判定整个环境，避免多工具逐个检测的复杂性 |
| 10 秒超时 | `claude --version` 超时保护，防止环境异常时阻塞 |

---

## 六、验证结果

| 验证项 | 状态 |
|---|---|
| `registerIpcHandlers()` 注册全部 7 个 handler | ✅ |
| `desktop:select-workspace` → 原生文件夹选择器弹出 | ✅ |
| 选择文件夹后路径通过 IPC 返回 Renderer | ✅ |
| 取消选择 → 返回 `null` | ✅ |
| 最近 workspace 路径记忆与恢复 | ✅ |
| `desktop:get-server-status` → 返回 server 状态 | ✅ |
| `desktop:get-cli-status` → `claude --version` 检测 | ✅ |
| Claude Code 可用 → codex/opencode 均为可用 | ✅ |
| Claude Code 不可用 → 全部为不可用 | ✅ |
| CLI 检测 10s 超时保护 | ✅ |
| TypeScript 编译：desktop 0 errors | ✅ |

---

## 七、Git 提交记录

| Commit | 说明 |
|---|---|
| (部分未提交) | Feat: IPC bridge + workspace selection + CLI detection |
