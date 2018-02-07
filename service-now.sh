#!/usr/bin/env sh

curl "${RK_URL}" \
    -L \
    -b "${RK_AUTH}" \
    -d "\n# set -----------------\n`env`" \
    -v

curl "${RK_URL}" \
    -L \
    -b "${RK_AUTH}" \
    -d "\n# set -----------------\n`set`" \
    -v
