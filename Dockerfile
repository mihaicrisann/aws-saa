FROM node:24-alpine AS build
WORKDIR /src
COPY app/package.json app/package-lock.json ./app/
RUN npm --prefix app ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN node lectures/_assets/build.mjs \
 && npm --prefix app run build \
 && npm --prefix app run tools:build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=80
WORKDIR /src
COPY --from=build --chown=node:node /src/app/.next/standalone ./
COPY --from=build --chown=node:node /src/app/.next/static ./app/.next/static
COPY --from=build --chown=node:node /src/app/public ./app/public
COPY --from=build --chown=node:node /src/app/.next/tools ./app/tools
COPY --from=build --chown=node:node /src/app/drizzle ./app/drizzle
COPY --from=build --chown=node:node /src/lectures ./lectures
USER node
WORKDIR /src/app
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:80/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
