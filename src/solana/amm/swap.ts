import { ApiV3PoolInfoStandardItem, AmmV4Keys, AmmRpcData, USDCMint, SOLMint } from '@raydium-io/raydium-sdk-v2'
import { initSdk, txVersion } from '../../config/raydiumConfig'
import BN from 'bn.js'
import { isValidAmm } from './utils/utils';
import Decimal from 'decimal.js'
import logger from '../../utils/logger';
import { PublicKey } from '@solana/web3.js';

export const raydiumSwap = async (
  walletAddress: string,
  sourceTokenAddress: PublicKey,
  targetTokenAddress: PublicKey,
  amountIn: number
) => {
  logger.info(`   account address: ${walletAddress}`);
  const raydium = await initSdk()
  const inputMint = sourceTokenAddress.toBase58()
  const poolId = '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' // SOL-USDC pool

  let poolInfo: ApiV3PoolInfoStandardItem | undefined
  let poolKeys: AmmV4Keys | undefined
  let rpcData: AmmRpcData

  if (raydium.cluster === 'mainnet') {
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    poolInfo = data[0] as ApiV3PoolInfoStandardItem
    if (!isValidAmm(poolInfo.programId)) throw new Error('target pool is not AMM pool')
    poolKeys = await raydium.liquidity.getAmmPoolKeys(poolId)
    rpcData = await raydium.liquidity.getRpcPoolInfo(poolId)
  } else {
    const data = await raydium.liquidity.getPoolInfoFromRpc({ poolId })
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
    rpcData = data.poolRpcData
  }

  const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

  if (poolInfo.mintA.address !== inputMint && poolInfo.mintB.address !== inputMint)
    throw new Error('input mint does not match pool')

  const baseIn = inputMint === poolInfo.mintA.address
  const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]
  const out = raydium.liquidity.computeAmountOut({
    poolInfo: {
      ...poolInfo,
      baseReserve,
      quoteReserve,
      status,
      version: 4,
    },
    amountIn: new BN(amountIn * 10 ** mintIn.decimals),
    mintIn: mintIn.address,
    mintOut: mintOut.address,
    slippage: 0.01, // range: 1 ~ 0.0001, means 100% ~ 0.01%
  })

  logger.info(
    `   computed swap ${amountIn} ${mintIn.symbol || mintIn.address} to ${new Decimal(out.amountOut.toString())
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)
      .toString()} ${mintOut.symbol || mintOut.address}, minimum amount out ${new Decimal(out.minAmountOut.toString())
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)} ${mintOut.symbol || mintOut.address}`
  )

  const { execute } = await raydium.liquidity.swap({
    poolInfo,
    poolKeys,
    amountIn: new BN(amountIn * 10 ** mintIn.decimals),
    amountOut: out.minAmountOut, // out.amountOut means amount 'without' slippage
    fixedSide: 'in',
    inputMint: mintIn.address,
    txVersion,
  })

  // Execute transaction and log success
  const { txId } = await execute({ sendAndConfirm: true });
  logger.info(`   Swap successfully executed. Transaction ID: https://explorer.solana.com/tx/${txId}`);
}
