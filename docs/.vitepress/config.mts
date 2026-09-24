import { defineConfig } from "vitepress";
import { llmsPlugin } from "./plugins/llms";

const REPO = "https://github.com/AstroxNetwork/muse-connector-template";
const BASE = "/muse-connector-template/";
const DESCRIPTION =
  "A deployable Meta Muse connector template: per-connection tokens, async job scaffolding, and one registry that generates routes, OpenAPI and llms.txt.";

const shared = {
  socialLinks: [{ icon: "github" as const, link: REPO }],
};

export default defineConfig({
  // Must match the repo name: GitHub Pages project sites are served from a
  // subpath, so every asset and link needs this prefix.
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,

  head: [["meta", { name: "theme-color", content: "#6355f5" }]],

  // Emits <page>.md for the copy button, plus llms.txt and llms-full.txt.
  // This site is about writing an llms.txt, so it should serve one.
  vite: {
    plugins: [llmsPlugin({ title: "Muse Connector Template", description: DESCRIPTION, base: BASE })],
  },


  // Locales live at the top level. `themeConfig.locales` only carries theme
  // strings — putting lang/title there leaves every page as en-US.
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: "Muse Connector Template",
      description:
        "A deployable Meta Muse connector template: per-connection tokens, async job scaffolding, and one registry that generates routes, OpenAPI and llms.txt.",
      themeConfig: {
        ...shared,
        nav: [
          { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
          { text: "Submit", link: "/guide/submit" },
          { text: "GitHub", link: REPO },
        ],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "What you're building", link: "/guide/getting-started" },
              { text: "Quickstart", link: "/guide/quickstart" },
              { text: "Make it yours", link: "/guide/build" },
              { text: "Async & paid work", link: "/guide/async-and-paid" },
              { text: "Deploy", link: "/guide/deploy" },
              { text: "Directory listing", link: "/guide/submit" },
              { text: "Gotchas", link: "/guide/gotchas" },
            ],
          },
        ],
        outline: { level: [2, 3], label: "On this page" },
        docFooter: { prev: "Previous", next: "Next" },
        lastUpdated: { text: "Last updated" },
        returnToTopLabel: "Back to top",
        darkModeSwitchLabel: "Theme",
        sidebarMenuLabel: "Menu",
        langMenuLabel: "Change language",
      },
    },

    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      title: "Muse Connector 模板",
      description:
        "可直接部署的 Meta Muse connector 模板：按连接签发的令牌、异步任务骨架，以及一份同时生成路由、OpenAPI 和 llms.txt 的注册表。",
      themeConfig: {
        ...shared,
        nav: [
          { text: "指南", link: "/zh/guide/getting-started", activeMatch: "/zh/guide/" },
          { text: "提交目录", link: "/zh/guide/submit" },
          { text: "GitHub", link: REPO },
        ],
        sidebar: [
          {
            text: "指南",
            items: [
              { text: "你在做什么", link: "/zh/guide/getting-started" },
              { text: "快速开始", link: "/zh/guide/quickstart" },
              { text: "改成你自己的", link: "/zh/guide/build" },
              { text: "异步与付费", link: "/zh/guide/async-and-paid" },
              { text: "部署", link: "/zh/guide/deploy" },
              { text: "提交目录", link: "/zh/guide/submit" },
              { text: "常见坑", link: "/zh/guide/gotchas" },
            ],
          },
        ],
        outline: { level: [2, 3], label: "本页目录" },
        docFooter: { prev: "上一篇", next: "下一篇" },
        lastUpdated: { text: "最后更新" },
        returnToTopLabel: "回到顶部",
        darkModeSwitchLabel: "外观",
        sidebarMenuLabel: "目录",
        langMenuLabel: "切换语言",
      },
    },
  },
});
