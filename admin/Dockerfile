FROM node:22.23.2-alpine3.23 AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY admin/package.json admin/package.json
COPY server/package.json server/package.json
RUN npm ci --workspace @clocdot/admin --include-workspace-root=false
COPY admin ./admin
WORKDIR /app/admin

ARG VITE_API_BASE
ARG VITE_CLIENT_URL
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_CLIENT_URL=$VITE_CLIENT_URL

RUN npm run build

FROM caddy:2.11.4-alpine
COPY --from=build /app/admin/dist /srv
COPY admin/Caddyfile /etc/caddy/Caddyfile
RUN addgroup -S -g 10001 app \
  && adduser -S -D -H -u 10001 -G app app \
  && chown -R app:app /srv /config /data
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
