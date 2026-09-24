# HolyCrab Muse Connector

[English](README.md) · **简体中文**

一个可直接部署的 [Meta Muse](https://muse.ai) connector 模板。

Muse 是 Meta 的个人 AI agent，通过 **connector** 接入第三方服务。做 connector
**不需要注册应用、也不需要 app id** —— 你只要暴露一个 HTTP API，让 Muse 能读取它的描述并调用。
本仓库就是那个 API，并且把最容易做错的部分都提前做好了。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAstroxNetwork%2Fholycrab-muse-connector&env=CONNECTOR_SECRET&envDescription=At%20least%2032%20random%20characters.%20Signs%20the%20tokens%20users%20paste%20into%20Muse.&project-name=holycrab-muse-connector&repository-name=holycrab-muse-connector)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AstroxNetwork/holycrab-muse-connector)

> **两个按钮部署出来的都是可运行的骨架，不是做好的 connector。** 里面的 operation 全是占位。
> 你拿到的是认证模型、异步任务管线、OpenAPI / llms.txt 生成，以及部署接线 ——
> 这样等业务确定后，加一个真实能力只是很小的一处改动。

已经替你处理好的部分：

- **按连接（per-connection）签发的令牌** —— 用户永远不需要把真实 API key 交给 Muse。
- **异步任务骨架** —— "轮询、不要重复提交"的模式，同时写进 OpenAPI 和 Muse 读的那份说明。
- **计费感知** —— 花钱的 operation 会被标记，Muse 必须先向用户确认。
- **单一注册表** —— 路由、`/openapi.json`、`/llms.txt` 全部由同一份 operation 列表生成，不会各自漂移。
- **三种部署目标** —— Vercel、Cloudflare Workers、Docker。

```
Muse ──(hcm_ 令牌)──▶ muse.example.com ──(服务方凭证)──▶ 你的 API
       可撤销、按连接限定      这个 connector        只存在服务端
```

---

## 快速开始

```bash
npm install
cp .env.example .env
# 在 CONNECTOR_SECRET 里填一个 32 位以上的随机字符串
export $(grep -v '^#' .env | xargs)
npm run dev
```

看看 Muse 会读到什么：

```bash
curl -s localhost:8787/openapi.json | jq '.paths | keys'
curl -s localhost:8787/llms.txt
```

签发一个令牌并调用：

```bash
TOKEN=$(curl -s -X POST localhost:8787/v1/link \
  -H 'content-type: application/json' \
  -H "x-link-secret: $LINK_SECRET" \
  -d '{"subject":"you@example.com"}' | jq -r .token)

curl -s localhost:8787/v1/me -H "Authorization: Bearer $TOKEN" | jq
```

跑测试 —— 测试本身就是规格说明：

```bash
npm test        # 36 个测试
npm run typecheck
```

---

## 部署

### 一键部署

用上面的按钮，或直接点：

| 目标 | 链接 |
|---|---|
| Vercel | [vercel.com/new/clone](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAstroxNetwork%2Fholycrab-muse-connector&env=CONNECTOR_SECRET&envDescription=At%20least%2032%20random%20characters.%20Signs%20the%20tokens%20users%20paste%20into%20Muse.&project-name=holycrab-muse-connector&repository-name=holycrab-muse-connector) |
| Cloudflare Workers | [deploy.workers.cloudflare.com](https://deploy.workers.cloudflare.com/?url=https://github.com/AstroxNetwork/holycrab-muse-connector) |

两个流程都会问你要 `CONNECTOR_SECRET`（32 位以上随机字符）。其余变量部署完再补：

- `PUBLIC_URL` —— Muse 实际调用的地址，例如 `https://muse.example.com`
- `DASHBOARD_URL` —— 用户撤销授权的地方
- `LINK_SECRET` —— 保护 `POST /v1/link`

### Vercel（CLI）

```bash
npm i -g vercel
vercel link
vercel env add CONNECTOR_SECRET      # 32 位以上
vercel env add KV_REST_API_URL       # 来自 Vercel KV 或 Upstash
vercel env add KV_REST_API_TOKEN
vercel deploy --prod
```

`vercel.json` 会把所有路径重写到 `api/index.ts`，这样对外 URL 保持在根路径 ——
Muse 必须看到 `https://muse.example.com/openapi.json`，而不是 `/api/openapi.json`。

### Cloudflare Workers（CLI）

```bash
npm i -g wrangler
wrangler kv namespace create MUSE_KV   # 然后在 wrangler.jsonc 里取消 kv_namespaces 注释
wrangler secret put CONNECTOR_SECRET
npm run deploy:cf
```

`wrangler.jsonc` 故意保持最小：不含任何硬编码的资源 id，也不含自定义域名，
这样一键部署按钮对任何人都能用。它开启了 `nodejs_compat` ——
因为 `tokens.ts` 用了 `node:crypto`，不开这个标志 Worker 无法打包。

### Docker

```bash
docker build -t muse-connector .
docker run -p 8787:8787 \
  -e CONNECTOR_SECRET=... \
  -e PUBLIC_URL=https://muse.example.com \
  muse-connector
```

### ⚠️ 有真实用户之前，务必接上真正的存储

没有接 KV 时，connector 把连接信息**存在内存里**。本地没问题，但在 serverless 上不行：
每个请求可能落在新的 isolate 上，于是用户会莫名其妙被登出；更糟的是，
**撤销授权只对某一个 isolate 生效**。缺少绑定时 Worker 会打印警告。

配置 `KV_REST_API_URL` / `KV_REST_API_TOKEN`（Vercel KV 或 Upstash），
或者绑定 `MUSE_KV`（Cloudflare KV），它会自动切换。

---

## 改成你自己的服务

只需要改三处，其余都是管道。

### 1. 能力定义 —— `src/operations.registry.ts`

这就是你要改的文件。删掉三个 `demo*` operation，然后每个能力加一个 `Operation`：

```ts
{
  id: "createVideo",              // 保持稳定；模型可能会引用它
  method: "post",
  path: "/v1/videos",
  summary: "根据提示词生成视频",
  description: "启动一次生成，返回一个需要跟踪的任务。",
  input: { schema: z.object({ prompt: z.string().min(1).max(4000) }) },
  spends: { kind: "credits", note: "消耗 1 个生成积分。" },
  async: { pollWith: "getVideo", typicalSeconds: 90 },
  handler: ({ provider, connection, body, idempotencyKey }) =>
    provider.createVideo(connection, body as any, idempotencyKey),
}
```

这一条定义就同时产出了路由、OpenAPI 路径、`/llms.txt` 里的一行，
以及"不要重复提交"的警告 —— 因为 `spends` 和 `async` 只声明一次。

### 2. 服务实现 —— `src/providers/`

按你的真实 API 实现 `ProviderPort`。`providers/placeholder.ts` 演示了形状，也是你要删掉的。

### 3. 持久化

已经处理好了 —— 见上面的警告。

---

## 真正重要的两条规则

一个 connector 对 Muse 好用与否，大部分不取决于代码。

### 绝不要让付费工作被重复提交

生成是异步的，而且花钱。如果 Muse 为了"查进度"重试了一次 `POST`，用户就会被扣两次钱。所以：

- 把创建类 operation 标为 `async`，并让 `pollWith` 指向读取类 operation
- 标记 `spends`，让描述里直接写明会花钱
- 支持 `Idempotency-Key`（骨架已经做了，而且有测试覆盖）

`/llms.txt` 里用明确的措辞写清了这一点，OpenAPI 里也带了
`x-long-running`、`x-poll-operationId` 和 `x-requires-confirmation`。

### 说清楚这个调用"不会"做什么

描述是给正在决定要不要动手的模型读的。"读取你的余额" 不如
"只读。此调用无法转移资金。" 把边界写出来。

---

## 提交到 Muse 目录

作为 **Custom Connector** 被访问，不需要 Meta 做任何事 —— 用户今天就能把 Muse 指向你的 URL。
进入**目录**是另一套带审核的流程，见 [`connector/SUBMISSION.md`](connector/SUBMISSION.md)。

开始前需要知道两件事：

- Meta **不审核** Custom Connector，官方自己也是这么说的。后果由你承担。
- 针对目录收录，Meta 至今**没有公布**分成比例、费用和审核时长。

---

## 接口

| 路由 | 认证 | 用途 |
|---|---|---|
| `GET /health`、`/healthz` | 无 | 健康检查 |
| `GET /openapi.json` | 无 | Muse 用来学习 API 的文件 |
| `GET /llms.txt`、`/` | 无 | 同样内容的文字版 |
| `POST /v1/link` | `x-link-secret` | 你的后台 → 一个连接 + 令牌 |
| `GET /v1/me` | connector 令牌 | 我是谁 / 被授予了什么 |
| 其余 | connector 令牌 | 你自己的 operation |

错误格式为 RFC 9457 `problem+json`。

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `CONNECTOR_SECRET` | 是 | 32 位以上。轮换它会让所有已签发令牌失效。 |
| `PUBLIC_URL` | 建议 | 会写进 OpenAPI 的 `servers` |
| `DASHBOARD_URL` | 建议 | 用户撤销授权的地方 |
| `LINK_SECRET` | 生产必需 | 保护 `POST /v1/link` |
| `KV_REST_API_URL` / `_TOKEN` | 生产必需 | 或 `UPSTASH_REDIS_REST_*` |
| `PORT` | 否 | 默认 8787（仅 Docker / Node） |

## 许可证

Apache-2.0。部分代码衍生自 [1Claw AI 的 muse-connector](https://github.com/1clawAI/muse-connector)，
详见 [`NOTICE`](NOTICE)。
