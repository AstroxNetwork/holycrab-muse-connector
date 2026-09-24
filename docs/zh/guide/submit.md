# 提交到目录

这是两件不同的事，区别比看上去更重要。

|  | Custom Connector | 目录收录 |
|---|---|---|
| **方式** | 用户把 Muse 指向你的 URL 并提供令牌 | 在 `muse.ai/platform` 提单 |
| **审核** | **不审核** —— Meta 官方明确说明 | 功能 + 安全 + 法务 + 端到端测试 |
| **分发** | 无；用户必须已经知道你的 URL | 进目录，可被选入精选位 |
| **速度** | 当天可用 | 未知；Meta 未公布 SLA |
| **条款** | 除通用 ToS 外没有别的 | 必须接受 Muse Connector Terms |

## 先走 Custom Connector

它不需要 Meta 做任何事，所以**先验证**。把 Muse 指向你的部署，确认它能理解你的异步模型，
再去投入提交。值得检查的几点：

- 问合适的问题时，Muse 会不会调用你的读取操作？
- 遇到付费操作时，它会不会先说明花费并等你确认？
- 它是在轮询你的任务，而不是重复提交？
- 超时之后它是继续轮询，而不是起第二个任务？

如果哪一条不成立，问题几乎总是出在你的 `description` 文字上，而不是代码。
在 `src/operations.registry.ts` 里改完，再去看一遍 `/llms.txt`。

## Meta 的原话

来自 Meta 官方关于 custom connector 的帮助文档：

> If you want to connect to a service not yet available in the Connector list,
> you can ask Muse to create a Custom Connector… Muse stores these in its Secure
> Credentials Store. **Meta doesn't review custom connectors** or how they use
> your information, so grant access with caution.

最后那句话是双向的。没有门槛要过 —— 但也没有安全网。后果由你承担。

## 提交收录

提交流程分三步：

1. **描述你的产品** —— 包括示例 prompt，一行一条。这决定了 Muse 什么时候会想到你。
2. **审核** —— Meta 检查功能、安全和法务要求，并跑一遍端到端测试。
3. **进入目录** —— 用户能找到你的 connector；精选位由编辑另行挑选。

[`connector/SUBMISSION.md`](https://github.com/AstroxNetwork/muse-connector-template/blob/main/connector/SUBMISSION.md)
里有一份准备清单，包括安全审查的问答表格和给 Meta 审核人员用的端到端测试计划。

## 在以此做规划之前

有两件事 Meta **没有**公布：

- **分成与费用。** 完全没有披露。在读到 Connector Terms 之前，
  把商业模型当作未知 —— 而那份条款只有登录后才可见。
- **审核时长。** 没有 SLA。

如果你的商业判断依赖其中任何一个数字，先去条款里拿到它，再投入工程时间。
