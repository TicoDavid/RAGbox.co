# Stage 1: Build
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o server ./cmd/server

# Stage 2: Run
FROM gcr.io/distroless/static-debian12

COPY --from=builder /app/server /server
COPY --from=builder /app/migrations /migrations
COPY --from=builder /app/internal/service/prompts /prompts

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/server"]
