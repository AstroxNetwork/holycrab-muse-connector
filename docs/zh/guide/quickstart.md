# 快速开始

五分钟跑起来。需要 Node 20 或更高版本。

## 1. 克隆并安装

```bash
git clone https://github.com/AstroxNetwork/muse-connector-template.git my-connector
cd my-connector
npm install
```

## 2. 设置三个变量

```bash
cp .env.example .env

CONNECTOR_SECRET=$(openssl rand -base64 48)   # 32 位以上
PUBLIC_URL=http://localhost:8787              # 本地允许 http
DASHBOARD_URL=https://example.com             # 必须是 https
LINK_SECRET=dev-link-secret
```

::: warning 这三个变量故意没有默认值
`PUBLIC_URL` 会写进 OpenAPI 的 `servers` —— 也就是 Muse 被指向去调用的地址。
`DASHBOARD_URL` 会打印给用户，作为撤销授权的地方。
有默认值就意味着：一个没配全的部署会告诉 Muse 去调用错误的地址，并把用户送到错误的站点。
所以 connector 选择直接拒绝启动。详见[常见坑](/zh/guide/gotchas)。
:::

## 3. 启动

```bash
export $(grep -v '^#' .env | xargs)
npm run dev
```

它会打印一条关于缺 KV 的警告。本地这是正常的 —— 见[部署](/zh/guide/deploy#persistence)。

## 4. 看看 Muse 会读到什么

```bash
curl -s localhost:8787/openapi.json | jq '.paths | keys'
# [ "/v1/me", "/v1/things", "/v1/jobs", "/v1/jobs/{id}" ]

curl -s localhost:8787/llms.txt
```

这四个 operation 都是占位的。仔细读一下 `llms.txt` 的输出：
**你写进 operation 的每一个字都会出现在里面**，而那段文字正是模型用来判断何时调用你的依据。

## 5. 签发令牌并调用

```bash
TOKEN=$(curl -s -X POST localhost:8787/v1/link \
  -H 'content-type: application/json' \
  -H 'x-link-secret: dev-link-secret' \
  -d '{"subject":"you@example.com"}' | jq -r .token)

curl -s localhost:8787/v1/me -H "Authorization: Bearer $TOKEN" | jq
```

## 6. 跑测试

```bash
npm test        # 50 个测试
npm run typecheck
```

测试本身就是规格说明。最值得先读的是幂等那条 —— 它断言重试一个已付费操作时，
返回的是同一个任务，而不是创建第二个。

## 接下来

- **[改成你自己的](/zh/guide/build)** —— 声明你自己的能力。
- **[异步与付费](/zh/guide/async-and-paid)** —— 真正需要用心处理的部分。
- **[部署](/zh/guide/deploy)** —— Vercel、Cloudflare 或 Docker。
