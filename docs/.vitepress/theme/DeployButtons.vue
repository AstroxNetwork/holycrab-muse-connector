<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";

/**
 * Standalone one-click deploy buttons for the docs home page.
 *
 * Uses the vendors' own badges rather than restyled buttons: they are
 * recognisable, and they stay correct if Vercel or Cloudflare changes them.
 * Both badges are designed for a light background, so dark mode adds a ring
 * to the dark Vercel badge instead of pasting a white block behind it.
 */
const { lang } = useData();
const isZh = computed(() => String(lang.value).toLowerCase().startsWith("zh"));

const REPO = "https://github.com/AstroxNetwork/muse-connector-template";
const BASE = "/muse-connector-template/";

const vercelUrl =
  "https://vercel.com/new/clone" +
  `?repository-url=${encodeURIComponent(REPO)}` +
  "&env=CONNECTOR_SECRET" +
  "&envDescription=" +
  encodeURIComponent(
    "At least 32 random characters. Signs the tokens users paste into Muse.",
  ) +
  "&env=PUBLIC_URL" +
  "&envDescription=" +
  encodeURIComponent(
    "The https URL you are deploying to. Muse is told to call this.",
  ) +
  "&env=DASHBOARD_URL" +
  "&envDescription=" +
  encodeURIComponent("Where your users review or revoke access.") +
  "&project-name=muse-connector" +
  "&repository-name=muse-connector";

const cloudflareUrl = `https://deploy.workers.cloudflare.com/?url=${REPO}`;

const guideHref = computed(() => withBase(isZh.value ? "/zh/guide/deploy" : "/guide/deploy"));
</script>

<template>
  <div class="deploy">
    <p class="deploy__label">
      {{ isZh ? "部署你自己的" : "Deploy your own" }}
    </p>

    <div class="deploy__badges">
      <a
        class="deploy__badge deploy__badge--vercel"
        :href="vercelUrl"
        target="_blank"
        rel="noreferrer"
        :aria-label="isZh ? '部署到 Vercel' : 'Deploy with Vercel'"
      >
        <img src="https://vercel.com/button" alt="Deploy with Vercel" height="32" />
      </a>

      <a
        class="deploy__badge deploy__badge--cloudflare"
        :href="cloudflareUrl"
        target="_blank"
        rel="noreferrer"
        :aria-label="isZh ? '部署到 Cloudflare' : 'Deploy to Cloudflare'"
      >
        <img
          src="https://deploy.workers.cloudflare.com/button"
          alt="Deploy to Cloudflare"
          height="39"
        />
      </a>
    </div>

    <p class="deploy__hint">
      <template v-if="isZh">
        两者都只需 <code>CONNECTOR_SECRET</code>、<code>PUBLIC_URL</code> 和
        <code>DASHBOARD_URL</code>。不确定选哪个？
        <a :href="guideHref">对比两种部署</a>。
      </template>
      <template v-else>
        Both ask only for <code>CONNECTOR_SECRET</code>, <code>PUBLIC_URL</code> and
        <code>DASHBOARD_URL</code>. Not sure which?
        <a :href="guideHref">Compare the two targets</a>.
      </template>
    </p>
  </div>
</template>

<style scoped>
.deploy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  margin: 2rem auto 0;
  padding: 1.35rem 1.5rem;
  max-width: 34rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--muse-radius, 12px);
  background: var(--vp-c-bg-soft);
}

.deploy__label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.deploy__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
}

.deploy__badge {
  display: inline-flex;
  border-radius: 7px;
  line-height: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.deploy__badge:hover {
  transform: translateY(-1px);
  box-shadow: var(--muse-shadow-lg, 0 8px 20px rgba(0, 0, 0, 0.16));
}

.deploy__badge img {
  display: block;
  height: 40px;
  width: auto;
}

/* The Vercel badge is #1A1A1A — nearly invisible on a dark page. A ring gives
   it an edge without putting a white slab behind it. */
.dark .deploy__badge--vercel {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.dark .deploy__badge--vercel:hover {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45),
    var(--muse-shadow-lg, 0 8px 20px rgba(0, 0, 0, 0.4));
}

.deploy__hint {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  text-align: center;
}

.deploy__hint code {
  font-size: 0.78rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  padding: 0.1em 0.32em;
  border-radius: 4px;
}
</style>
