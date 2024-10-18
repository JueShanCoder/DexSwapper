## 代码结构
### src/config/*
- raydiumConfig: 初始化 raydium SDK 配置

### src/ethereum/*
- uniswap: 基于 uniswapV2 Router 实现 Token Swap

### src/solana/*
- amm/swap: 基于 raydium SDK 实现指定 pool 的 Token Swap
- routeSwap: 基于 raydium SDK 实现基于路由路径的  Token Swap
- cache/util: 路由路径缓存 query 之后的 pool 信息

## 项目配置
- 基于根目录下的 .env_example 来自定义 .env 文件

## 项目编译启动
``` shell
npm run build

npm run start 
```