# 常见坑

## 为什么 `PUBLIC_URL` 和 `DASHBOARD_URL` 是必填的？

它们不是装饰，也不是我们对配置吹毛求疵。

- `PUBLIC_URL` 会变成 OpenAPI 的 `servers` 条目 —— **也就是 Muse 被指向去调用的地址。**
- `DASHBOARD_URL` 会打印给用户，出现在 `llms.txt` 和每一个 `401` 里 ——
  **也就是你告诉他们去撤销授权的地方。**

有默认值就意味着：一个没配全的部署会把 Muse 和你的用户都指向别人的网站。
所以 connector 选择拒绝启动，并告诉你原因：

```text
[muse-connector] PUBLIC_URL is required — it is the address Muse is told to call,
and goes in the OpenAPI servers entry
```

配置还会强制这些规则：

| 规则 | 原因 |
|---|---|
| `CONNECTOR_SECRET` ≥32 位 | 太短的 HMAC 密钥不值得用 |
| URL 必须是绝对地址 | 相对值没法放进 `servers` |
| 必须是 `https`，本机除外 | Muse 跑在远端 VM 里，不会调用明文 http |
| 自动去掉结尾斜杠 | 否则拼接路径会出错 |

## 必须用子域名吗？

不必。任何公网 HTTPS 地址都可以。见[部署 → 必须用子域名吗？](/zh/guide/deploy#subdomain)。

## 这需要 MCP 吗？

不需要。Muse 的 custom connector 走的是普通 REST 加一份 OpenAPI 文档。

MCP 是另一套协议，而且属于另一个产品：**Muse Code**，Meta 的终端编码 agent，
它确实支持 MCP（通过 `~/.config/muse/settings.json` 里的 `mcpServers`）。那跟这里不是一回事。

网上大量的混淆都来自把这两个东西当成一个。

## 如果模型在错误的时机调用了怎么办？

每个调用都会经过 Meta 的权限层，它可以放行、拒绝，或者询问用户。
那个决定不由你控制 —— 你能控制的是让请求对它来说有多好读。

三个字段承担这个工作：

- `summary` —— 一句话，用祈使句
- `description` —— 说明它做什么，**以及它不做什么**
- `spends` —— 把"要花钱"明说出来

## Connector 跑起来了，但 Muse 从不调用它

几乎总是下面之一：

1. **`summary` 太含糊。** 模型是把用户意图和你的文字做匹配。
   "获取任务" 不如 "查看一个已经开始生成的视频的进度"。
2. **operation 没进注册表。** 检查
   `curl -s localhost:8787/openapi.json | jq '.paths | keys'`。
3. **spec 取不到。** Muse 会从你的 `PUBLIC_URL` 拉取 `/openapi.json`。
   确认它公网可达、走 https，而且你的 WAF 没有拦掉非浏览器流量。

## 全部都返回 401

按可能性排序：

1. 用户撤销了连接，或者这个连接从来就没进过当前这个存储。
2. `CONNECTOR_SECRET` 被轮换了，这会让所有已签发令牌失效。
3. 你在 serverless 上跑、但没配 KV，请求落在了从没见过这条连接的 isolate 上。
   这就是内存存储的失败模式 —— 见[部署](/zh/guide/deploy#persistence)。

## 完全不用 Muse 也能用吗？

能。它就是一个带令牌签发端点的、经过认证的 OpenAPI 服务。
把任何 agent 指向它都行 —— 这种通用性是刻意的。

## 真的是 Apache-2.0 吗？

是。随便 fork、改名、去掉品牌。你重新分发的那部分文件保留 `NOTICE` 就行。
你部署的服务不需要标注来源。
