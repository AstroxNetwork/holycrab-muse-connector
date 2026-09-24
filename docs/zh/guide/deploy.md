# 部署

同一份源码，三种目标。核心代码里没有任何平台相关逻辑 ——
每个目标都只是一个很薄的入口，接的是同一个 app。

## Vercel

```bash
npm i -g vercel
vercel link
vercel env add CONNECTOR_SECRET
vercel env add PUBLIC_URL        # https://muse.your-domain.com
vercel env add DASHBOARD_URL     # https://your-domain.com
vercel env add KV_REST_API_URL   # Vercel KV 或 Upstash
vercel env add KV_REST_API_TOKEN
vercel deploy --prod
```

`vercel.json` 会把所有路径重写到 `api/index.ts`，这样对外 URL 保持在根路径。
Muse 必须看到 `https://muse.your-domain.com/openapi.json`，而不是 `/api/openapi.json`。

::: tip 一键部署
[README](https://github.com/AstroxNetwork/muse-connector-template#readme) 里有
**Deploy with Vercel** 按钮，会在部署流程里提示你填写三个必填变量。
:::

## Cloudflare Workers

```bash
npm i -g wrangler
wrangler kv namespace create MUSE_KV   # 然后取消 wrangler.jsonc 里 kv_namespaces 的注释
wrangler secret put CONNECTOR_SECRET
npm run deploy:cf
```

`wrangler.jsonc` 开了 `nodejs_compat`，这是**必须的** ——
签名令牌用了 `node:crypto`。不开这个标志 Worker 无法打包。

随仓库提供的配置故意保持最小：没有硬编码的资源 id，也没有自定义域名，
这样一键部署按钮对任何人都能用。等你掌控了域名，再取消 `routes` 那段的注释。

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
缺少绑定时服务会打印警告，这是故意的。
:::

| 存储 | 怎么启用 |
|---|---|
| Cloudflare KV | 在 `wrangler.jsonc` 里绑定 `MUSE_KV` |
| Vercel KV / Upstash | 设置 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` |
| 其他任意方案 | 实现只有四个方法的 `ConnectionStore` 接口 |

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
或者测试时的 `*.workers.dev` 地址。

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
