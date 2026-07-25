FROM node:22-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/mock-data/package.json packages/mock-data/package.json
RUN npm ci

COPY apps/web apps/web
COPY packages packages
ARG VITE_BACKEND_URL=""
ARG VITE_WS_URL=""
ARG VITE_USE_MOCK="false"
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL} \
    VITE_WS_URL=${VITE_WS_URL} \
    VITE_USE_MOCK=${VITE_USE_MOCK}
RUN npm run build --workspace=@ican/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

