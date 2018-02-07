FROM alpine:3.6

RUN apk upgrade --no-cache
RUN apk add --no-cache ca-certificates curl

COPY /service-now.sh /service-now

ENTRYPOINT ["/service-now"]