# 部署

三种目标，一份代码。核心就是一个普通的 Hono app，每个目标都只是套在外面的一层很薄的适配器 ——
所以你在 `src/operations.registry.ts` 或 `src/providers/` 里写的东西，没有任何平台相关代码。

## 选哪个？

| | Vercel | Cloudflare Workers |
|---|---|---|
| 运行时 | Node.js serverless function | V8 isolate |
| 入口 | `api/index.ts`（`hono/vercel`） | `src/worker.ts`（default export） |
| 路由 | 需要 `vercel.json` 把所有路径重写到 `/api` | Worker 天然接管所有路径 |
| 冷启动 | Node function 启动 | 基本没有 |
| `node:crypto` | 原生支持 | **必须开 `nodejs_compat`** |
| 存储往返 | KV 走 REST —— 多一次网络跳转 | KV binding，进程内 |
| 配置放在 | 控制台，或 `vercel env` | `wrangler.jsonc` + `wrangler secret` |
| 本地开发 | `vercel dev` | `wrangler dev` |
| 自定义域名 | Vercel 控制台 | `wrangler.jsonc` 里的 `routes`，或控制台 |

**选 Cloudflare，如果**你要最低延迟、DNS 已经在 Cloudflare，或者请求量大到在意单次成本。
原生 KV binding 还能省掉每次认证请求的一次网络跳转 —— 而每个请求都要认证。

**选 Vercel，如果**你要完整的 Node 兼容性、已经在用 Vercel，
或者宁愿调试 Node function 而不是 Worker。Workers 通过 `nodejs_compat`
跑的是 Node 的一个子集；Vercel 跑的是真正的 Node。

**两者都不构成锁定。** 两个入口都不到 60 行，存在的意义只是调用 `createApp()`。
在两者之间迁移就是一个下午的事。

## 什么是共享的

```text
src/app.ts                 HTTP 接口层              ─┐
src/operations.registry.ts 你的能力定义               ├─ 到哪里都一样
src/providers/             你的服务实现              ─┘
────────────────────────────────────────────────────────
api/index.ts               Vercel 适配器
src/worker.ts              Cloudflare 适配器
src/index.ts               Node / Docker 适配器
```

## Vercel

### 一键部署

用[首页](/zh/)上的 **Deploy with Vercel** 按钮，它会在部署流程里提示你填三个必填变量。

### 命令行

```bash
npm i -g vercel
vercel link
vercel env add CONNECTOR_SECRET      # openssl rand -base64 48
vercel env add PUBLIC_URL            # https://muse.your-domain.com
vercel env add DASHBOARD_URL         # https://your-domain.com
vercel env add KV_REST_API_URL       # Vercel KV 或 Upstash
vercel env add KV_REST_API_TOKEN
vercel deploy --prod
```

`vercel.json` 会把所有路径重写到 `api/index.ts`，这样对外 URL 保持在根路径。
Muse 必须看到 `https://muse.your-domain.com/openapi.json`，而不是 `/api/openapi.json`。
如果你改了 base path，**先检查这里** —— 重写规则漏掉 `/openapi.json`，connector 对 Muse 就是隐形的。

### Vercel 上的存储

Vercel KV 底层就是 Upstash，所以两者都行。connector 会读你提供的那一组：

- `KV_REST_API_URL` + `KV_REST_API_TOKEN`（Vercel KV）
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`（直接用 Upstash）

适配器通过 `fetch` 说 REST 协议，所以没有 SDK 要装。

## Cloudflare Workers

### 一键部署

用[首页](/zh/)上的 **Deploy to Cloudflare** 按钮，它会克隆仓库并部署；
你提供 `CONNECTOR_SECRET`，并在 `wrangler.jsonc` 里（或作为 secret）设置那两个 URL。

### 命令行

```bash
npm i -g wrangler
wrangler kv namespace create MUSE_KV   # 然后取消 wrangler.jsonc 里 kv_namespaces 的注释
wrangler secret put CONNECTOR_SECRET
npm run deploy:cf
```

### Workers 上容易踩的坑

**`nodejs_compat` 是必须的。** 签名令牌用 `node:crypto` 做 HMAC。
这个标志已经在 `wrangler.jsonc` 里开好了；不开 Worker 无法打包。

**`wrangler.jsonc` 里的 `vars` 是提交进仓库的。** `PUBLIC_URL` 和 `DASHBOARD_URL`
放在那里，因为它们不是密钥。`CONNECTOR_SECRET` 是密钥 ——
放进 `wrangler secret`，永远不要写进文件。任何把真实密钥写进 `vars` 的 fork，都等于把它公开了。

**不接 KV，撤销就会失效。** 没有绑定时 Worker 把连接存在内存里，而每个 isolate 各有一份。
缺少绑定时它会打印警告。

### Cloudflare 上的存储

绑定一个 KV namespace 作为 `MUSE_KV`。它是原生的 —— 没有 REST 跳转，
所以每个认证请求都比 Vercel 那边更便宜。

## Docker 或任何主机

```bash
docker build -t muse-connector .
docker run -p 8787:8787 \
  -e CONNECTOR_SECRET=... \
  -e PUBLIC_URL=https://muse.your-domain.com \
  -e DASHBOARD_URL=https://your-domain.com \
  muse-connector
```

镜像以非特权用户运行，并带了针对 `/health` 的健康检查。

## 持久化 —— 有真实用户前必做 {#persistence}

::: danger 没有存储时，连接信息存在内存里
本地没问题，serverless 上不行：每个请求可能落在新的 isolate 上，用户会莫名其妙被登出。
更糟的是 —— **撤销授权只对某一个 isolate 生效**，也就是说"断开"并不能可靠地断开。
:::

| 目标 | 存储 | 怎么做 |
|---|---|---|
| Cloudflare | KV binding | 在 `wrangler.jsonc` 里绑定 `MUSE_KV` |
| Vercel | KV over REST | 设置 `KV_REST_API_URL` + `KV_REST_API_TOKEN` |
| Docker | KV over REST | 同一组变量 |
| 其他 | 你自己的 | 实现只有四个方法的 `ConnectionStore` |

切换是自动的：配了 KV 就会用它。

```ts
export interface ConnectionStore {
  get(connectionId: string): Promise<ConnectionRecord | undefined>;
  upsert(subject: string, patch?: Partial<ConnectionRecord>): Promise<ConnectionRecord>;
  disconnect(connectionId: string): Promise<boolean>;
  find(subject: string): Promise<ConnectionRecord | undefined>;
}
```

整个接口就这些。Postgres、DynamoDB、一个文件，都行。

## 必须用子域名吗？ {#subdomain}

**不必。** 任何公网 HTTPS 地址都可以：子域名、主域名下的路径，
或者测试时的 `*.workers.dev` / `*.vercel.app` 地址。

不过用子域名是个好习惯，有两个具体原因：

1. 你的主站很可能已经占用了 `/llms.txt` 和 `/openapi.json`，
   而这个 connector 需要在自己的根路径上提供这两个。
2. 主站的 WAF 可能把非浏览器的 API 流量当成机器人流量。Muse 是从 Meta 的基础设施调用的。

## 环境变量参考

| 变量 | 必需 | 说明 |
|---|---|---|
| `CONNECTOR_SECRET` | 是 | 32 位以上，`openssl rand -base64 48`。轮换它会让所有已签发令牌失效 |
| `PUBLIC_URL` | 是 | Muse 调用的地址，会写进 OpenAPI 的 `servers` |
| `DASHBOARD_URL` | 是 | 用户查看或撤销授权的地方 |
| `SERVICE_NAME` | 否 | 默认 `Muse Connector` |
| `LINK_SECRET` | 生产必需 | 保护 `POST /v1/link` |
| `KV_REST_API_URL` / `_TOKEN` | 生产必需 | 或 `UPSTASH_REDIS_REST_*` |
| `PORT` | 否 | 默认 8787（仅 Docker / Node） |

`PUBLIC_URL` 必须是 `https`，除非是本机 —— Muse 跑在远端 VM 里，不会调用明文 http。
