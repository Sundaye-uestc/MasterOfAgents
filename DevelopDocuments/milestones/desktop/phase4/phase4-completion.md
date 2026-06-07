# Desktop Phase 4 开发完成文档

**完成日期：** 2026-06-07

> **最后更新：** 2026-06-07 — 打包 + 一键构建脚本 + 便携版部署 全部完成

---

## 概述

Phase 4 实现桌面端完整打包分发能力：electron-builder 配置、asar 结构优化、workspace 依赖注入、一键构建脚本、以及便携版一键启动。

- **打包配置**：Windows dir 目标，extraResources 包含 server + web 构建产物，asarUnpack 提取 node_modules
- **Post-processing**：@agenthub/shared 注入、server/node_modules junction 桥接
- **Build Script**：`scripts/build-portable.mjs` — 一键编译 + 打包 + 部署
- **Portable Launcher**：`启动AgentHub.bat` — 清除 ELECTRON_RUN_AS_NODE 后启动

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 说明 |
|---|---|
| `scripts/build-portable.mjs` | 一键构建脚本：6 步全自动编译、打包、部署 |
| `AgentHub-Desktop-Portable/启动AgentHub.bat` | 便携版启动器（清除 ELECTRON_RUN_AS_NODE + 启动 AgentHub.exe） |

### 1.2 修改文件

| 文件 | 说明 |
|---|---|
| `apps/desktop/electron-builder.yml` | Windows dir 目标、extraResources（server + web）、asarUnpack（node_modules/**）|
| `apps/desktop/package.json` | `dist` script（electron-builder），dependencies 包含 server 运行时需要的所有 npm 包 |
| `AgentHub/package.json` | 新增 `build:portable` script → `node scripts/build-portable.mjs` |

---

## 二、electron-builder 配置

### 2.1 关键配置项

```yaml
# electron-builder.yml
appId: com.agenthub.desktop
productName: AgentHub

win:
  target:
    - target: dir       # --dir 目标，跳过 NSIS 安装包（避免 winCodeSign 问题）
      arch: [x64]
  sign: null             # 跳过签名（MVP）

# Desktop app code only — no node_modules (extracted via asarUnpack)
files:
  - dist/**/*
  - node_modules/**/*    # 打包时包含，构建时通过 asarUnpack 提取
  - package.json

# Server + Web dist → real filesystem (server 子进程可访问)
extraResources:
  - from: ../server/dist
    to: server
  - from: ../web/dist
    to: web

# 所有 node_modules 提取到 asar 外（子进程 Node.js 可读）
asarUnpack:
  - node_modules/**
```

### 2.2 目标选择

| 目标 | 状态 | 说明 |
|------|------|------|
| NSIS .exe 安装包 | ❌ | winCodeSign 7za symlink 错误阻塞（Windows 非开发者模式）|
| dir（unpacked）| ✅ | 直接产出可运行目录，跳过签名步骤 |

### 2.3 asar 结构

```
resources/
├── app.asar                          # 仅 dist/ + package.json（~65KB）
├── app.asar.unpacked/
│   └── node_modules/                 # 所有 npm 依赖（真实文件系统）
│       ├── hono/
│       ├── sql.js/
│       ├── ws/
│       └── @agenthub/
│           └── shared/               # 手动注入（workspace 包不在 desktop 依赖中）
├── server/                           # extraResources: apps/server/dist/
│   ├── index.js
│   ├── app.js
│   ├── package.json                  # 手动复制（ESM "type": "module" 检测）
│   └── node_modules → ../../app.asar.unpacked/node_modules/  # Junction
└── web/                              # extraResources: apps/web/dist/
    ├── index.html
    └── assets/
```

---

## 三、Post-Processing（构建脚本自动化）

### 3.1 @agenthub/shared 注入

**问题**：`@agenthub/shared` 是 workspace 内部包（`workspace:*`），不在 desktop 的 `dependencies` 中，electron-builder 不会将其包含在 unpacked node_modules 中。

**解决**：构建脚本在 electron-builder 完成后，将 `packages/shared/dist/` + `package.json` 复制到 `app.asar.unpacked/node_modules/@agenthub/shared/`。

### 3.2 Server package.json

**问题**：`apps/server/dist/` 没有 `package.json`，Node.js ESM 加载器无法检测 `"type": "module"`，导致 `MODULE_TYPELESS_PACKAGE_JSON` 警告。

**解决**：构建脚本在编译后、打包前复制 `apps/server/package.json` → `apps/server/dist/package.json`。

### 3.3 Server/node_modules Junction

**问题**：ESM 不使用 `NODE_PATH` 解析模块，必须通过文件系统上的 `node_modules/` 目录查找。

**解决**：构建脚本创建 Windows directory junction：

```
resources/server/node_modules → resources/app.asar.unpacked/node_modules
```

Junction 在 release 目录和 portable 目录各创建一次。

---

## 四、一键构建脚本

### 4.1 执行流程

```
pnpm build:portable
  │
  ├─ [1] Build workspace packages (shared / server / web / desktop)
  │     跳过 @agenthub/mobile（避免无关的 PWA build 错误阻塞）
  │
  ├─ [2] Copy server/package.json → server/dist/
  │
  ├─ [3] electron-builder --dir
  │     CSC_IDENTITY_AUTO_DISCOVERY=false
  │     清除 winCodeSign cache（避免 7za symlink 错误）
  │     忽略 winCodeSign 下载错误（--dir 已完成打包）
  │     ✓ 验证 app.asar 存在
  │
  ├─ [4] Inject @agenthub/shared into unpacked node_modules
  │     验证 dist/index.js 存在
  │
  ├─ [5] Create server/node_modules junction → unpacked node_modules
  │
  └─ [6] Deploy to AgentHub-Desktop-Portable/
        移除旧 junction → 清理旧文件 → 复制 release → 创建 junction
        保留 启动AgentHub.bat
```

### 4.2 错误处理

| 步骤 | 错误策略 |
|------|---------|
| Build | 立即失败，显示失败包名 |
| electron-builder | 忽略 winCodeSign 错误，验证 asar 存在后继续 |
| shared 注入 | 验证 `dist/index.js`，缺失则失败 |
| Junction | 权限不足时警告但不阻塞（build script 已预创建）|
| Deploy | 旧文件删除失败 → 逐文件清理，保留 batch |

---

## 五、Portable Launcher

```batch
@echo off
title AgentHub Launcher
cd /d "%~dp0"
REM Remove ELECTRON_RUN_AS_NODE if inherited from VSCode/Claude terminal
set ELECTRON_RUN_AS_NODE=
"AgentHub.exe"
```

- **用途**：便携版一键启动，双击即可运行
- **环境清理**：清除可能从开发工具继承的 `ELECTRON_RUN_AS_NODE`
- **路径无关**：`%~dp0` 确保在任何位置启动都能找到 AgentHub.exe

---

## 六、已知限制与 Workaround

| 限制 | 原因 | Workaround |
|------|------|------------|
| winCodeSign 7za 解压失败 | Windows 非开发者模式不支持 POSIX symlink | 使用 `--dir` 目标 + `ignoreError` |
| app.asar 可能被锁定 | Windows Defender 或其他进程占用 | 重启后替换 `app-new.asar` |
| Junction 需管理员权限 | Windows `SeCreateSymbolicLinkPrivilege` | build script 阶段创建（终端权限通常更高）|
| `pnpm` field 警告 | pnpm v11 不再识别 package.json 中的 `pnpm.onlyBuiltDependencies` | 无害，可忽略 |

---

## 七、验证结果

| 验证项 | 状态 |
|---|---|
| `pnpm build:portable` 全流程通过（~29s）| ✅ |
| Step 1: 4 个包编译成功 | ✅ |
| Step 2: server package.json 复制到 dist | ✅ |
| Step 3: electron-builder 产出 app.asar（~65KB）| ✅ |
| Step 4: @agenthub/shared 注入验证 | ✅ |
| Step 5: Junction 创建成功 | ✅ |
| Step 6: 部署到 portable 目录 | ✅ |
| 便携版启动 10s 无崩溃 | ✅ |
| Server 自动检测端口 + 启动 | ✅ |
| Web UI 正确加载（代理模式）| ✅ |
| ESM 模块解析正常（dotenv、hono、sql.js 等）| ✅ |
| 一键停止（窗口关闭）→ 所有服务清理 | ✅ |
| 开发模式一键启动：server + web + mobile + desktop | ✅ |

---

## 八、Git 提交记录

| Commit | 说明 |
|---|---|
| `ac817f7` | Docs: desktop system design + module design + development todo |
| `7a205fd` | Chore: add .logs/ to .gitignore |
| (部分未提交) | Feat: electron-builder config + build script + portable launcher |
| (部分未提交) | Fix: server hostname 127.0.0.1 + IPv6 port detection |
