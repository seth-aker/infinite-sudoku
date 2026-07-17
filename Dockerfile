# BUILD STAGE
FROM alpine:latest AS c_builder

RUN apk add --no-cache build-base cmake

WORKDIR /cdoku

COPY --from=generator_src . .

RUN cmake -B build -S . -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build

FROM node:24-bookworm AS build

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

ARG DEPLOY_MODE
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /apps

COPY . ./sudoku
COPY ./frontend/.env.production ./sudoku/frontend/
WORKDIR /apps/sudoku 
RUN pnpm i
RUN if [ "$DEPLOY_MODE" = "test" ]; then \
      pnpm run build:test; \
    else \
      pnpm run build; \
    fi

# BACKEND
FROM node:24-alpine AS backend

RUN apk update && apk upgrade --no-cache && \
    apk add curl && \
    rm -rf /var/lib/apk/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /sudoku

RUN mkdir -p /sudoku/logs && chown -R node:node /sudoku/logs

COPY --from=build /apps/sudoku/backend/dist ./
COPY --from=build /apps/sudoku/backend/package.json .
COPY --from=build /apps/sudoku/backend/pnpm*.yaml .
COPY --chown=node:node --from=c_builder /cdoku/build/src/app/puzzle_generator_app .

WORKDIR /sudoku

RUN pnpm ci --prod

# Remove npm and yarn to minimize vulnerabilities
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -rf /opt/yarn-* \
    && rm /usr/local/bin/npm \
    && rm /usr/local/bin/npx \
    && rm /usr/local/bin/yarn \
    && rm /usr/local/bin/yarnpkg

EXPOSE 3666

ENV NODE_ENV=production

USER node

CMD [ "node", "index.js" ]

# FRONTEND
FROM nginxinc/nginx-unprivileged:alpine AS frontend

COPY --from=build /apps/sudoku/frontend/dist /usr/share/nginx/html
COPY --from=build /apps/sudoku/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
