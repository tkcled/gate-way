### nodemon with ts
```
    "exec": "node --require ts-node/register --require tsconfig-paths/register ./src/index.ts"
```

### nodemon with bun
```
    "exec": bun ./src/index.ts"
```

## Start

```sh
    bun install
```

then 
```sh
    bun run dev
```

build
```
    bun run build:ncc
```