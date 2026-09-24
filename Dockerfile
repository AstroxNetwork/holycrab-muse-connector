# ── Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts
# tsc is a devDependency, so install it just for the build stage.
RUN npm install --no-save typescript@5
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ── Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
# Run unprivileged: the connector holds a token-signing secret and is
# reachable from the internet, so it has no business being root.
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
