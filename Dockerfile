FROM oven/bun:1

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install

COPY src ./src

RUN mkdir -p /app/items /app/merged

CMD ["bun", "run", "src/index.ts"]