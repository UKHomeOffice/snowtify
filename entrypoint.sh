#!/usr/bin/env sh

# make sure the internal ID file exists if it is supplied
affirm() {
    if [ -n "$1" ] ; then
        export PLUGIN_INTERNAL_ID_FILE="$(cd "$(dirname "$1")"; pwd)/$(basename "$1")"
        touch "${PLUGIN_INTERNAL_ID_FILE}"
    fi
}

affirm "${PLUGIN_INTERNAL_ID_FILE:-$SNOW_INT_ID_FILE}"

cd /app/
./snowtify
