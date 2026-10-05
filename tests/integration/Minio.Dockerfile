FROM golang:1.24.8-alpine AS build
ARG MINIO_COMMIT=7aac2a2c5b7c882e68c1ce017d8256be2feea27f
WORKDIR /src
RUN wget -qO- "https://codeload.github.com/minio/minio/tar.gz/${MINIO_COMMIT}" | tar xz --strip-components=1
RUN CGO_ENABLED=0 GOTOOLCHAIN=local go build -p 2 -trimpath -o /minio .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /usr/share/licenses/minio/LICENSE
ENTRYPOINT ["minio"]
