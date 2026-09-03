FROM node:22.23.2-alpine3.23

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY admin/package.json admin/package.json
COPY server/package.json server/package.json
RUN npm ci --workspace @clocdot/server --include-workspace-root=false
COPY server ./server
WORKDIR /app/server
RUN npx prisma generate

ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]
