# BUILD STAGE (alpine)
FROM alpine@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS c_builder

RUN apk add --no-cache build-base cmake

WORKDIR /cdoku

COPY --from=generator_src . .

RUN cmake -B build -S . -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build

# (node:24-bookworm)
FROM node@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS build

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

ARG DEPLOY_MODE
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /apps

COPY ./frontend ./sudoku/frontend
COPY ./frontend/.env.production ./sudoku/frontend/
# For the frontend about page
COPY ./README.md ./sudoku
COPY ./backend ./sudoku/backend

WORKDIR /apps/sudoku/frontend

RUN CI=true pnpm i && \
  if [ "$DEPLOY_MODE" = "test" ]; then \
    pnpm run build:test; \
  else \
    pnpm run build; \
  fi

WORKDIR /apps/sudoku/backend

RUN CI=true pnpm i && pnpm build;

# BACKEND (node:24-alpine)
FROM node@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS backend

RUN apk update && apk upgrade --no-cache && \
    apk add curl && \
    rm -rf /var/lib/apk/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /sudoku

RUN mkdir -p /sudoku/logs && chown -R node:node /sudoku/logs

COPY --from=build /apps/sudoku/backend/dist ./
COPY --from=build /apps/sudoku/backend/db ./db
COPY --from=build /apps/sudoku/backend/package.json .
COPY --from=build /apps/sudoku/backend/pnpm-lock.yaml .
COPY --from=build /apps/sudoku/backend/pnpm-workspace.yaml .

COPY --chown=node:node --from=c_builder /cdoku/build/src/app/puzzle_generator_app .

RUN pnpm i --prod

EXPOSE 3666

ENV NODE_ENV=production

USER node

CMD [ "node", "index.js" ]

# FRONTEND (nginxinc/nginx-unprivileged:alpine)
FROM nginxinc/nginx-unprivileged@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e AS frontend

COPY --from=build /apps/sudoku/frontend/dist /usr/share/nginx/html
COPY --from=build /apps/sudoku/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
