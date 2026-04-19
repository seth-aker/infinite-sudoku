FROM node:24-alpine

RUN apk update && apk upgrade

WORKDIR /sudoku

COPY ./dist ./

COPY ./vue-sudoku.db .
COPY ./.env.production ./.env
COPY ./sql ./sql
COPY ./package.json .
COPY ./puzzle_generator_app .

RUN npm i --omit=dev

EXPOSE 3666

ENV NODE_ENV=production

CMD [ "node", "index.js" ]
