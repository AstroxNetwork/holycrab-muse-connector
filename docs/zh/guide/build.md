# 改成你自己的

只需要改三处，其余都是管道。

## 1. 声明你的能力

打开 `src/operations.registry.ts`。删掉三个 `demo*` operation，然后每个能力加一个 `Operation`。

这一条定义会生成：

- HTTP 路由
- OpenAPI 路径
- `/llms.txt` 里的一行
- 助手针对它的行为规则

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

### 真正重要的字段

| 字段 | 作用 |
|---|---|
| `id` | `operationId`。保持稳定 —— 模型可能会引用它，`pollWith` 也指向它 |
| `summary` | 模型读的一句话，用祈使句 |
| `description` | 一小段说明。**必须写清它"不会"做什么** |
| `input` | Zod schema，在你的 handler 执行前完成校验 |
| `spends` | 标记这个操作要花用户的钱 |
| `async` | 标记它返回一个任务，并指明去轮询哪个操作 |
| `outputSchema` | 200 响应的 JSON Schema，只用于 OpenAPI 文档 |

`spends` 和 `async` 在[异步与付费](/zh/guide/async-and-paid)里详述。
它们决定了一个 connector 是行为端正，还是会悄悄让用户被扣两次钱。

## 2. 实现你的服务

在 `src/providers/` 里对接你的真实 API，做完后删掉 `placeholder.ts`。

接口一开始故意做得很小：

```ts
export interface ProviderPort {
  whoami(connection: ConnectionRecord): Promise<WhoAmI>;
  // 上面每声明一个 operation，这里就加一个方法
}
```

`placeholder.ts` 是一个完整示例。它也演示了幂等模式 ——
用 `连接 + Idempotency-Key` 映射到任务 id，这样重试会返回原来的任务。

### 控制调用方看到的状态码

抛出带状态码的 `UpstreamError`。这是 connector 其余部分唯一依赖的约定：

```ts
import { UpstreamError } from "../provider.js";

throw new UpstreamError(`no such job: ${id}`, 404);
```

能识别的状态码会原样透传，其他意外情况统一变成 `502`。

## 3. 命名

`SERVICE_NAME` 控制 OpenAPI 标题、`/health` 和 `llms.txt`。默认是 `Muse Connector`。

包名、bin 名和仓库名随你改。改掉它们不会有任何影响 —— 没有东西依赖它们。

## 怎么检查改对了

改完之后，确认生成的两份文档符合预期：

```bash
curl -s localhost:8787/openapi.json | jq '.paths | keys'
curl -s localhost:8787/llms.txt
```

如果某个 operation 在两者里都不见了，说明它没进注册表。
如果它出现在 OpenAPI 里、但模型不知道**什么时候**该调用它，那问题在你的 `description` ——
那段文字才是接口。
