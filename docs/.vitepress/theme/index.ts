import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import CopyMarkdown from "./CopyMarkdown.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // Sits directly under the page title, above the content — visible without
      // scrolling, which is where you want it if you came here to copy.
      "doc-before": () => h(CopyMarkdown),
    });
  },
};
