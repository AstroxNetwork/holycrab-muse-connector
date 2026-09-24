import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Emits, alongside the built HTML:
 *
 *   <page>.md        the raw markdown for every page, so a "Copy as Markdown"
 *                    button can fetch it and any agent can read it directly
 *   llms.txt         an index of the docs, per the llmstxt.org convention
 *   llms-full.txt    every page concatenated, for one-shot ingestion
 *
 * This site is about writing an `llms.txt`, so it should serve one. Doing it
 * here rather than via a plugin keeps the dependency count at zero — this is a
 * template, and every dependency a fork inherits is a cost.
 */

export interface LlmsPluginOptions {
  title: string;
  description: string;
  /** Site base, e.g. `/muse-connector-template/`. */
  base: string;
}

interface Page {
  /** Path relative to the docs root, e.g. `guide/quickstart.md`. */
  rel: string;
  title: string;
  description?: string;
  body: string;
}

const SKIP_DIRS = new Set([".vitepress", "node_modules", "public"]);

function walkMarkdown(dir: string, root: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkMarkdown(full, root, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(path.relative(root, full));
    }
  }
  return out;
}

/** Minimal frontmatter reader — enough for `title`, `description` and `hero.name`. */
function readFrontmatter(src: string): {
  data: Record<string, string>;
  heroName?: string;
  body: string;
} {
  if (!src.startsWith("---")) return { data: {}, body: src };
  const end = src.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: src };

  const block = src.slice(3, end);
  const data: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (m?.[1] && m[2] !== undefined) {
      data[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }

  // Home pages carry their display name under `hero.name`, not `title`.
  const heroBlock = /^hero:\s*\n((?:[ \t]+.*\n?)*)/m.exec(block)?.[1] ?? "";
  const heroName = /^\s*name:\s*(.+)$/m.exec(heroBlock)?.[1]
    ?.replace(/^["']|["']$/g, "")
    .trim();

  return { data, heroName, body: src.slice(end + 4).replace(/^\s*\n/, "") };
}

function firstHeading(body: string): string | undefined {
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
}

/** First real paragraph, trimmed to a sensible index length. */
function firstParagraph(body: string): string | undefined {
  const lines = body
    .split("\n")
    .filter(
      (l) =>
        !l.startsWith("#") &&
        !l.startsWith(":::") &&
        !l.startsWith("```") &&
        !l.startsWith("|"),
    );
  const para = lines.join("\n").split(/\n\s*\n/).find((p) => p.trim().length > 0);
  if (!para) return undefined;
  const text = para
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

export function llmsPlugin(options: LlmsPluginOptions): Plugin {
  let docsRoot = "";
  let outDir = "";
  // VitePress builds a client and an SSR bundle, so closeBundle fires twice.
  // The work is idempotent, but doing it twice just logs twice.
  let emitted = false;

  const toUrl = (rel: string): string => {
    const clean = `${options.base.replace(/\/$/, "")}/${rel}`.replace(/\.md$/, "");
    return clean.endsWith("/index") ? clean.slice(0, -"index".length) : clean;
  };

  return {
    name: "muse-llms-and-markdown",
    apply: "build",

    configResolved(config) {
      docsRoot = config.root;
      outDir = path.resolve(docsRoot, ".vitepress/dist");
    },

    closeBundle() {
      if (emitted) return;
      emitted = true;

      const pages: Page[] = [];

      for (const rel of walkMarkdown(docsRoot, docsRoot).sort()) {
        const relPosix = rel.replace(/\\/g, "/");
        const src = fs.readFileSync(path.join(docsRoot, rel), "utf8");
        const { data, heroName, body } = readFrontmatter(src);
        pages.push({
          rel: relPosix,
          title: data.title ?? heroName ?? firstHeading(body) ?? relPosix,
          description: data.description ?? firstParagraph(body),
          body,
        });

        // Ship the raw markdown next to the rendered HTML so the copy button
        // (and any agent) can fetch it at `<page>.md`.
        const dest = path.join(outDir, relPosix);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, src, "utf8");
      }

      const section = (heading: string, items: Page[]): string =>
        items.length
          ? `\n## ${heading}\n\n${items
              .map(
                (p) =>
                  `- [${p.title}](${toUrl(p.rel)})${
                    p.description ? `: ${p.description}` : ""
                  }`,
              )
              .join("\n")}\n`
          : "";

      const en = pages.filter((p) => !p.rel.startsWith("zh/"));
      const zh = pages.filter((p) => p.rel.startsWith("zh/"));

      const index = `# ${options.title}

> ${options.description}

Every page below is also available as raw Markdown at the same URL with \`.md\`
appended. The full text of the documentation is in llms-full.txt.
${section("English", en)}${section("简体中文", zh)}
## Full text

- [llms-full.txt](${options.base.replace(/\/$/, "")}/llms-full.txt)
`;
      fs.writeFileSync(path.join(outDir, "llms.txt"), index, "utf8");

      const full = pages
        .map((p) => `<!-- ${p.rel} -->\n\n${p.body.trim()}\n\n<!-- end ${p.rel} -->`)
        .join("\n\n---\n\n");
      fs.writeFileSync(
        path.join(outDir, "llms-full.txt"),
        `# ${options.title}\n\n> ${options.description}\n\n${full}\n`,
        "utf8",
      );

      const kb = (f: string) =>
        (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1);
      console.log(
        `  ✓ llms.txt ${kb("llms.txt")} kB · llms-full.txt ${kb(
          "llms-full.txt",
        )} kB · ${pages.length} markdown files`,
      );
    },
  };
}
