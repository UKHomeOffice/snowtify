FROM quay.io/ukhomeofficedigital/nodejs-base:v6

RUN yum clean -q all && \
    yum update -y -q && \
    rpm --rebuilddb --quiet

WORKDIR /app
COPY ./package.json /app/
ENV NODE_ENV production
RUN npm install --only production > .npm-install.log 2>&1 && rm .npm-install.log || ( EC=$?; cat .npm-install.log; exit $EC )

COPY . /app

RUN chown -R nodejs:nodejs .

USER nodejs
CMD [ "npm", "start" ]