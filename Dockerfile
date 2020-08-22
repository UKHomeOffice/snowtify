FROM node:12-alpine AS base

RUN apk upgrade --no-cache

WORKDIR /app
COPY ./package.json /app/
ENV NODE_ENV production
RUN npm install --only production > .npm-install.log 2>&1 && rm .npm-install.log || ( EC=$?; cat .npm-install.log; exit $EC )

COPY src /app/src
COPY snowtify entrypoint.sh /app/

ENTRYPOINT ["/app/entrypoint.sh"]


FROM base

RUN apk upgrade --no-cache \
 && apk add git

COPY .eslintignore .eslintrc.yaml /app/
COPY test /app/test

ENV NODE_ENV ci
RUN npm install > .npm-install.log 2>&1 && rm .npm-install.log || ( EC=$?; cat .npm-install.log; exit $EC ) && \
    npm test


FROM base
