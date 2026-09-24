<script setup lang="ts">
import { computed, ref } from "vue";
import { useData, withBase } from "vitepress";

/**
 * Fetches this page's raw Markdown (emitted by the llms plugin) and copies it.
 * Deliberately fetches rather than reconstructing from the DOM: the point is to
 * give the reader exactly the source, frontmatter and all.
 */
const { page, lang } = useData();
const state = ref<"idle" | "copying" | "copied" | "error">("idle");

const isZh = computed(() => String(lang.value).toLowerCase().startsWith("zh"));

const label = computed(() => {
  if (state.value === "copied") return isZh.value ? "已复制" : "Copied";
  if (state.value === "error") return isZh.value ? "复制失败" : "Copy failed";
  return isZh.value ? "复制 Markdown" : "Copy Markdown";
});

const rawHref = computed(() => withBase(page.value.relativePath));

async function copy() {
  state.value = "copying";
  try {
    const res = await fetch(rawHref.value);
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    state.value = "copied";
  } catch {
    state.value = "error";
  }
  setTimeout(() => (state.value = "idle"), 1600);
}
</script>

<template>
  <div class="copy-md">
    <button
      type="button"
      class="copy-md__btn"
      :data-state="state"
      :disabled="state === 'copying'"
      @click="copy"
    >
      <svg
        v-if="state === 'copied'"
        class="copy-md__icon"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <path
          d="M13.5 4.5 6.5 11.5 2.5 7.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <svg
        v-else
        class="copy-md__icon"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <rect
          x="5.5"
          y="5.5"
          width="9"
          height="9"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          d="M10.5 5.5v-2A1.5 1.5 0 0 0 9 2H3A1.5 1.5 0 0 0 1.5 3.5v6A1.5 1.5 0 0 0 3 11h2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <span>{{ label }}</span>
    </button>
    <a class="copy-md__raw" :href="rawHref" target="_blank" rel="noreferrer">
      {{ isZh ? "查看原文" : "View raw" }}
    </a>
  </div>
</template>

<style scoped>
.copy-md {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 1.4rem;
}

.copy-md__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 550;
  line-height: 1;
  padding: 0.42rem 0.7rem;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.copy-md__btn:hover:not(:disabled) {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.copy-md__btn:disabled {
  opacity: 0.6;
  cursor: progress;
}

.copy-md__btn[data-state="copied"] {
  color: var(--vp-c-green-1, #10b981);
  border-color: currentColor;
}

.copy-md__btn[data-state="error"] {
  color: var(--vp-c-danger-1, #e5484d);
  border-color: currentColor;
}

.copy-md__icon {
  flex: 0 0 auto;
}

.copy-md__raw {
  font-size: 0.82rem;
  color: var(--vp-c-text-3);
  text-decoration: none;
}

.copy-md__raw:hover {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}
</style>
