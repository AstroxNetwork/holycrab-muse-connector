# 异步与付费

这是 connector 最容易出错的地方，而且几乎从来不是代码问题 ——
是一个措辞问题，最后变成账单问题。

生成是异步的，而且花用户的钱。如果模型为了"查进度"重试了一次 `POST`，
**用户就会被扣两次钱。**

::: danger 重复扣费的失败模式
慢操作 + 急切的模型 = 重复扣费。有三道防线，而且三道都要有。
:::

| 防线 | 位置 |
|---|---|
| 标 `spends`，让描述写明要花钱 | 你的 operation |
| 标 `async` + `pollWith`，让模型去轮询而不是重提 | 你的 operation |
| 支持 `Idempotency-Key`，让重试返回同一个任务 | 你的 provider |

## 只声明一次

```ts
spends: { kind: "credits", note: "消耗 1 个生成积分。" },
async: { pollWith: "getVideo", typicalSeconds: 90 },
```

## 这会生成什么

OpenAPI 里会多出机器可读的提示：

```json
{
  "x-long-running": true,
  "x-poll-operationId": "getVideo",
  "x-typical-seconds": 90,
  "x-cost-kind": "credits",
  "x-cost-note": "消耗 1 个生成积分。",
  "x-requires-confirmation": true
}
```

模型读到的 `description` 会变成：

```text
COSTS THE PERSON: Costs 1 generation credit. Do not call this until they have
agreed to this specific request. This returns immediately with a job to track —
poll `getVideo` (typically ready in about 90s). Do not resubmit to "check"
progress; that would create a second job.
```

而 `/llms.txt` 会长出一段模型每次会话都会读到的内容：

```text
## Waiting on work
- `createVideo` returns a job; poll `getVideo` (about 90s).

Polling is free and safe. **Re-submitting is not** — it starts a second job.
A timeout is not a failure: keep polling the same job.
```

另外，只要有任何一个操作会花钱，就会多出一节 **Spending the person's money**，
里面明确写着：对话早些时候一句笼统的"行，可以"不构成对新一笔扣费的同意。

## 支持 Idempotency-Key

HTTP 层会把该请求头作为 `idempotencyKey` 透传下去。怎么用由你的 provider 决定：

```ts
async createJob(connection, input, idempotencyKey) {
  if (idempotencyKey) {
    const existing = seen.get(`${connection.id}:${idempotencyKey}`);
    if (existing) return { ...existing, deduplicated: true };
  }
  // ... 创建，然后把结果记到这个 key 上
}
```

`placeholder.ts` 实现的就是这个。测试套件也对此做了断言：

```ts
const first  = await create({ "idempotency-key": "same-intent" });
const second = await create({ "idempotency-key": "same-intent" });
expect(second.id).toBe(first.id);   // 不是第二个任务
```

## 说清楚这个调用"不会"做什么

描述是给正在决定要不要动手的模型读的。

| 较弱 | 更好 |
|---|---|
| "读取你的余额" | "只读。此调用无法转移资金。" |
| "获取你的任务" | "返回任务。不创建、不修改、不完成任何任务。" |
| "管理你的账号" | "列出已连接的账号。无法修改计费，也无法删除任何东西。" |

把边界写出来，正是它阻止模型向用户承诺你的 API 做不到的事。

## 为什么轮询安全、重提不安全

这一点值得写清楚，因为模型看不到你的数据库：

- **轮询**是一个 `GET`。它只读状态。做十次不花任何代价。
- **重提**是一个 `POST`。它创建状态。做两次就花两次钱。

所以被轮询的那个操作必须是真的免费且无副作用 ——
`pollWith` 要指向一个读取操作，绝不能指向任何可能触发工作的东西。
