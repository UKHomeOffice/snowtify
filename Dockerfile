FROM quay.io/ukhomeofficedigital/nodejs-base:v6 AS base

RUN yum clean -q all && \
    yum update -y -q && \
    rpm --rebuilddb --quiet

WORKDIR /app
COPY ./package.json /app/
ENV NODE_ENV production
RUN npm install --only production > .npm-install.log 2>&1 && rm .npm-install.log || ( EC=$?; cat .npm-install.log; exit $EC )

COPY index.js config.js entrypoint.sh /app/

RUN chown -R nodejs:nodejs .

USER nodejs
ENTRYPOINT ["/app/entrypoint.sh"]


FROM base

USER root
RUN yum install -y -q git && \
    yum clean -q all && \
    rpm --rebuilddb --quiet

COPY .eslintignore .eslintrc.yaml /app/
COPY test /app/test
RUN chown -R nodejs:nodejs .

USER nodejs
ENV NODE_ENV ci
RUN npm install > .npm-install.log 2>&1 && rm .npm-install.log || ( EC=$?; cat .npm-install.log; exit $EC ) && \
    npm test


FROM base
