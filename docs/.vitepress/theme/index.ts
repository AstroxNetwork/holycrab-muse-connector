import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import CopyMarkdown from "./CopyMarkdown.vue";
import HeroActions from "./HeroActions.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // Sits directly under the page title, above the content — visible without
      // scrolling, which is where you want it if you came here to copy.
      "doc-before": () => h(CopyMarkdown),
      // Home page only. This slot is a sibling of `.actions` in the hero, so
      // the frontmatter `actions` list is deliberately empty and this renders
      // the whole row: Vercel, Cloudflare, Quickstart.
      "home-hero-actions-after": () => h(HeroActions),
    });
  },
};
