# Desktop Phase 3 开发完成文档

**完成日期：** 2026-06-07

> **最后更新：** 2026-06-07 — 系统通知 + 本地预览服务 全部完成

---

## 概述

Phase 3 实现桌面端独有能力：系统级通知推送、以及 workspace 目录的本地静态文件预览服务。

- **系统通知**：封装 Electron Notification API，支持 run 完成/失败、权限审批、高风险操作预警
- **本地预览服务**：轻量 HTTP 静态文件服务器，绑定 127.0.0.1，为 WebPreviewCard 提供本地文件访问

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 说明 |
|---|---|
| `apps/desktop/src/main/notification.ts` | Electron Notification API 封装 |
| `apps/desktop/src/main/preview-server.ts` | 本地静态文件 HTTP 服务器（仅监听 127.0.0.1） |

---

## 二、系统通知（Step 7）

### 2.1 Notification API 封装

```ts
// notification.ts
import { Notification } from "electron";

export function showNotification(opts: { title: string; body: string }): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: opts.title, body: opts.body });
  n.on("click", () => {
    // Focus the main window on notification click
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { win.focus(); win.restore(); }
  });
  n.show();
}
```

### 2.2 通知场景

| 场景 | 触发方式 | 标题 | 内容 |
|------|---------|------|------|
| Run 完成 | WebSocket `run:completed` → Renderer → IPC | "AgentHub" | "运行完成：<agentName>" |
| Run 失败 | WebSocket `run:failed` → Renderer → IPC | "AgentHub" | "运行失败：<error>" |
| 权限审批 | WebSocket `permission:requested` → Renderer → IPC | "AgentHub" | "权限审批请求：<toolName>" |
| 高风险操作 | WebSocket 特定事件 → Renderer → IPC | "AgentHub — 高风险" | "⚠️ <description>" |

### 2.3 Windows 配置

- `app.setAppUserModelId("com.agenthub.desktop")` — 通知分组标识
- 点击通知 → `win.focus()` + `win.restore()` — 聚焦主窗口

---

## 三、本地预览服务（Step 8）

### 3.1 静态文件服务器

```ts
// preview-server.ts
startPreviewServer(workspacePath: string, port?: number)
  → http.createServer()
  → bind "127.0.0.1" only (local access)
  → serves files from workspacePath
```

### 3.2 安全措施

- **仅本地绑定**：`127.0.0.1`，局域网不可达
- **目录穿越防护**：`path.resolve()` + startsWith 检查
- **MIME 类型**：15 种文件类型映射（`.html`, `.css`, `.js`, `.png`, `.pdf` 等）
- **目录请求**：自动查找 `index.html`

### 3.3 生命周期

```ts
// ipc-handlers.ts 中注册
ipcMain.handle("desktop:start-preview-server", (_e, workspacePath, port?) => ...)
ipcMain.handle("desktop:stop-preview-server", () => stopPreview())
ipcMain.handle("desktop:get-preview-url", (_e, relativePath) => getPreviewUrl(relativePath))
```

- 端口默认 4000（可自定义）
- 同一时间只允许一个预览服务实例
- 返回 `{ port, url }` 供 Renderer 使用

---

## 四、关键架构决策

| 决策 | 说明 |
|---|---|
| 通知触发链：WS → Renderer → IPC → Main | 保持 Renderer 作为控制中心，Main 只负责系统 API |
| 预览服务仅本地 | `127.0.0.1` 绑定，无需处理跨域或认证 |
| 不内嵌 iframe | 通过 URL 链接或 Electron `<webview>` 打开预览 |
| 通知去重 | 由 Renderer 层控制（与 web 端逻辑一致）|

---

## 五、验证结果

| 验证项 | 状态 |
|---|---|
| `showNotification({ title, body })` 系统通知弹出 | ✅ |
| 通知点击 → 主窗口聚焦 | ✅ |
| Notification.isSupported() 检测 | ✅ |
| `startPreviewServer(workspacePath)` → HTTP server 启动 | ✅ |
| 仅监听 127.0.0.1（局域网不可达）| ✅ |
| 文件路径目录穿越防护 | ✅ |
| MIME 类型正确映射 | ✅ |
| 目录请求 → `index.html` fallback | ✅ |
| `stopPreviewServer()` → server 关闭 | ✅ |
| `getPreviewUrl("sub/file.html")` → 正确 URL | ✅ |
| 重复启动 → 抛出错误 | ✅ |

---

## 六、Git 提交记录

| Commit | 说明 |
|---|---|
| (部分未提交) | Feat: system notifications + local preview server |
