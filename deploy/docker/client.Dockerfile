# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN npm install --global npm@11.6.1 && npm --version && npm ci

FROM dependencies AS build
ARG API_BASE_URL
ARG SITE_URL
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_RELEASE_ID
ARG NEXT_PUBLIC_ANALYTICS_ENABLED=false
ARG NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE=Asia/Kolkata
ARG NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED=false
ARG NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS
ARG NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION
ARG NEXT_PUBLIC_LEAD_CAPTURE_ENABLED=false
ARG NEXT_PUBLIC_LEAD_CONSENT_VERSION
ARG NEXT_PUBLIC_LEAD_CONSENT_TEXT
ENV API_BASE_URL=$API_BASE_URL \
    SITE_URL=$SITE_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_RELEASE_ID=$NEXT_PUBLIC_RELEASE_ID \
    NEXT_PUBLIC_ANALYTICS_ENABLED=$NEXT_PUBLIC_ANALYTICS_ENABLED \
    NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE=$NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE \
    NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED=$NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED \
    NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS=$NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS \
    NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION=$NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION \
    NEXT_PUBLIC_LEAD_CAPTURE_ENABLED=$NEXT_PUBLIC_LEAD_CAPTURE_ENABLED \
    NEXT_PUBLIC_LEAD_CONSENT_VERSION=$NEXT_PUBLIC_LEAD_CONSENT_VERSION \
    NEXT_PUBLIC_LEAD_CONSENT_TEXT=$NEXT_PUBLIC_LEAD_CONSENT_TEXT
COPY tsconfig.base.json tsconfig.json ./
COPY packages/contracts packages/contracts
COPY apps/client apps/client
RUN npm run build --workspace @niro/contracts && npm run build --workspace @niro/client

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /app/apps/client/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/client/.next/static ./apps/client/.next/static
# Contract validators resolve canonical JSON Schemas from this stable runtime path.
COPY --from=build --chown=nextjs:nodejs /app/packages/contracts/schemas ./packages/contracts/schemas
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'3000')+'/api/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/client/server.js"]
