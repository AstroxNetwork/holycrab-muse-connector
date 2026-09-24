---
layout: home

hero:
  name: Muse Connector 模板
  text: 一个下午做好你的 connector
  tagline: 可直接部署的 Meta Muse connector 模板。按连接签发的令牌、异步任务骨架，以及一份注册表同时生成路由、OpenAPI 和 llms.txt。
  actions:
    - theme: brand
      text: 开始快速上手
      link: /zh/guide/quickstart
    - theme: alt
      text: 你在做什么
      link: /zh/guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/AstroxNetwork/muse-connector-template

features:
  - title: 不需要注册应用
    details: 做 Muse connector 不需要 app id，也不需要审核。你只要暴露一个 HTTP API，让 Muse 读取它的描述并调用。用户今天就能把 Muse 指向你的地址。
  - title: 重复扣费已经处理好了
    details: 生成是异步的，而且花钱。一次重试的"查进度"POST 会让用户被扣两次。模板把"轮询、不要重提"的模式同时写进了 OpenAPI 和 Muse 读的那份说明。
  - title: 一份注册表，三个产物
    details: 能力只声明一次，就能得到路由、OpenAPI 路径、llms.txt 条目和助手的行为规则。它们不会各自漂移。
  - title: 没有锁定
    details: 可部署到 Vercel、Cloudflare Workers 或 Docker。存储只是一个四方法接口。不需要在我们这里注册账号、拿 key，也没有遥测。Apache-2.0。
  - title: 该严格的地方严格
    details: PUBLIC_URL 和 DASHBOARD_URL 是必填且要校验的，因为它们决定 Muse 被指向哪里、用户被送到哪里去撤销授权。
  - title: 50 个测试就是规格说明
    details: 认证、令牌伪造、过期、撤销、异步轮询流程和幂等重试都有覆盖。想知道"正确"长什么样，读测试就行。
---
