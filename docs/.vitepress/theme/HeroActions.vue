<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";

/**
 * The entire hero action row: deploy to Vercel, deploy to Cloudflare, quickstart.
 *
 * Rendered from the `home-hero-actions-after` slot rather than the frontmatter
 * `actions` list, because the deploy buttons are vendor badges. Note that slot
 * sits *outside* the `.actions` container in VitePress's hero, so the frontmatter
 * `actions` must stay empty or the row would split across two lines.
 */
const { lang } = useData();
const isZh = computed(() => String(lang.value).toLowerCase().startsWith("zh"));

const REPO = "https://github.com/AstroxNetwork/muse-connector-template";

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

const quickstartHref = computed(() =>
  withBase(isZh.value ? "/zh/guide/quickstart" : "/guide/quickstart"),
);
</script>

<template>
  <div class="hero-actions">
    <a
      class="hero-actions__badge hero-actions__badge--vercel"
      :href="vercelUrl"
      target="_blank"
      rel="noreferrer"
      :aria-label="isZh ? '部署到 Vercel' : 'Deploy with Vercel'"
    >
      <img src="https://vercel.com/button" alt="Deploy with Vercel" height="32" />
    </a>

    <a
      class="hero-actions__badge hero-actions__badge--cloudflare"
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

    <a class="hero-actions__primary" :href="quickstartHref">
      {{ isZh ? "快速上手" : "Quickstart" }}
    </a>
  </div>
</template>

<style scoped>
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-top: 24px;
}

.hero-actions__badge {
  display: inline-flex;
  border-radius: 7px;
  line-height: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

/* Both badges are drawn for a light background. The Vercel one is #1A1A1A, so
   dark mode gives it an edge rather than putting a white slab behind it. */
.dark .hero-actions__badge--vercel {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.hero-actions__badge:hover {
  transform: translateY(-1px);
  box-shadow: var(--muse-shadow-lg, 0 8px 20px rgba(0, 0, 0, 0.16));
}

.dark .hero-actions__badge--vercel:hover {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45),
    0 8px 20px rgba(0, 0, 0, 0.4);
}

.hero-actions__badge img {
  display: block;
  height: 40px;
  width: auto;
}

/* Sized to sit level with the badges without imitating their branding. */
.hero-actions__primary {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 20px;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--vp-c-brand-1), #8b5cf6);
  text-decoration: none;
  white-space: nowrap;
  transition: filter 0.15s ease, transform 0.15s ease;
}

.hero-actions__primary:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
}
</style>
