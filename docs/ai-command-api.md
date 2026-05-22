# AI 指令中心 API 配置

AI 指令中心默认使用 DeepSeek Chat Completions API 的 JSON Output 能力。前端会让模型只返回动作计划 JSON，应用再按白名单动作执行本地逻辑。

## 环境变量

```env
VITE_DEEPSEEK_API_KEY=your-deepseek-api-key
```

也可以在应用内进入“AI 指令中心”，在右侧“API 接口设置”里临时填入：

- 模型：默认 `deepseek-v4-flash`
- 接口地址：默认 `https://api.deepseek.com/chat/completions`
- API Key：仅保存在当前页面内存中，不写入 localStorage，刷新页面后清空

## 安全说明

当前版本为了方便个人使用，允许在浏览器端临时输入 API Key，并且不会持久化保存。正式部署为多人共用产品时仍建议改为后端代理：

1. 前端把用户指令和项目上下文发送给自己的后端。
2. 后端持有 DeepSeek API Key 并调用模型接口。
3. 后端只把结构化动作计划返回给前端。
4. 前端继续执行白名单动作，不允许模型直接写数据库。

## 支持动作

- `create_task`：创建普通任务
- `create_today_task`：发布今日任务，支持截止时间和提醒时间
- `create_milestone`：创建里程碑
- `create_diary`：写入开发日志
- `create_event`：记录时间线事件
- `configure_pomodoro`：调整番茄钟配置

## 测试示例

```text
帮我把“登录页优化”拆成 3 个任务，包含 UI、接口联调和测试，明天下午 6 点截止。
```

```text
今天发布两个紧急任务：修复同步失败提示、补充番茄钟通知测试，分别提醒我下午 4 点和 5 点。
```

```text
为本周创建一个“云同步联调完成”的里程碑，并写一篇今天的开发日志摘要。
```
