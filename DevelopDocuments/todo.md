# AgentHub 待办事项

**更新日期：** 2026-06-06

---

## 新功能

- [ ] **自建 Agent 修改头像功能**：Agent 管理面板中支持为自建 Agent 上传/修改头像

---

## Bug 修复

- [ ] **刷新后思考时间显示 1s（低优先级）**：正常情况下回复的思考时间正常显示，但刷新页面后都显示为 1s。需排查时间持久化/前端加载逻辑

---

## 移动端

- [ ] **对话历史缺少产物预览**：对话历史中仅展示文本消息，未对 HTML 网页、代码文件等产物提供内联预览卡片。应复用 web 端的 `InlineArtifactCard` 逻辑（按 artifact type/mimeType 渲染不同卡片：WebPreviewCard / TextPreviewCard / DownloadCard），在消息列表中嵌入显示。图片和 PPT 暂不处理

---
