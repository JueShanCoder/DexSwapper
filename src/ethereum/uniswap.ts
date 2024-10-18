import { ethers } from "ethers";
import { Fetcher, Route, Trade, TokenAmount, TradeType, Percent, Pair, Token } from '@uniswap/sdk';
import * as dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config()

export async function autoSwapTokens(
    amountIn: ethers.BigNumber, 
    tokenIn: Token, 
    tokenOut: Token, 
    wallet: ethers.Wallet,
    provider: ethers.providers.InfuraProvider
): Promise<ethers.providers.TransactionResponse> {
    try {
        logger.info(`   account address: ${wallet.address}`);
        const uniswapRouter = new ethers.Contract(
            process.env.UNISWAP_ROUTER_ADDRESS as string,
            [
                'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline)',
                'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)'
            ],
            wallet
        );
        // Define ERC20 contract for tokenIn and tokenOut to query balances
        const tokenInContract = new ethers.Contract(tokenIn.address, [
            'function balanceOf(address) view returns (uint256)',
            'function symbol() view returns (string)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)'
        ], wallet);
        const tokenOutContract = new ethers.Contract(tokenOut.address, [
            'function balanceOf(address) view returns (uint256)',
            'function symbol() view returns (string)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)'
        ], wallet);

        const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS as string;
        const factory = new ethers.Contract(
            factoryAddress,
            ['function getPair(address tokenA, address tokenB) external view returns (address pair)'],
            provider
        );

        // Query and log balances before swap
        const tokenInBalanceBefore = await tokenInContract.balanceOf(wallet.address);
        const tokenOutBalanceBefore = await tokenOutContract.balanceOf(wallet.address);

        const tokenInSymbol = await tokenInContract.symbol();
        const tokenOutSymbol = await tokenOutContract.symbol();
        logger.info(`   Before swap: ${tokenInSymbol} balance: ${ethers.utils.formatUnits(tokenInBalanceBefore, tokenIn.decimals)}`);
        logger.info(`   Before swap: ${tokenOutSymbol} balance: ${ethers.utils.formatUnits(tokenOutBalanceBefore, tokenOut.decimals)}`);

        let pair: Pair;
        const pairAddress = await factory.getPair(tokenIn.address, tokenOut.address);
        if (pairAddress === ethers.constants.AddressZero) {
            logger.info('   Liquidity pool does not exist. Creating pool and adding liquidity...');
            const amountADesired = ethers.utils.parseUnits("1000", 9);
            const amountBDesired = ethers.utils.parseUnits("1000", 6);
            const amountAMin = ethers.utils.parseUnits("900", 9);
            const amountBMin = ethers.utils.parseUnits("900", 6);
            const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
            const txAddLiquidity = await uniswapRouter.addLiquidity(
                tokenIn.address, tokenOut.address, amountADesired, amountBDesired, amountAMin, amountBMin, wallet.address, deadline,
                {
                    gasLimit: ethers.utils.hexlify(2000000), 
                    gasPrice: (await provider.getGasPrice()).mul(2)
                }
            );
            
            logger.info(`   Liquidity Pool created, transaction hash: ${txAddLiquidity.hash}`);
            await txAddLiquidity.wait();

            // After adding liquidity, re-fetch the pair data
            pair = await Fetcher.fetchPairData(tokenIn, tokenOut, provider);
            logger.info('   Liquidity pool created and pair data fetched.');
        } else {
            logger.info('   Liquidity pool exists, proceeding to swap...');
        }
        
        const path = [tokenOut.address,tokenIn.address];
        // 20 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
        const txSwap = await uniswapRouter.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            wallet.address,
            deadline,
            {
                gasLimit: ethers.utils.hexlify(3000000),
                gasPrice: await provider.getGasPrice()
            }
        );
        logger.info(`   Swap completed, transaction hash: ${txSwap.hash}`);

        // Query and log balances after swap
        const tokenInBalanceAfter = await tokenInContract.balanceOf(wallet.address);
        const tokenOutBalanceAfter = await tokenOutContract.balanceOf(wallet.address);
        logger.info(`   After swap: ${tokenInSymbol} balance: ${ethers.utils.formatUnits(tokenInBalanceAfter, tokenIn.decimals)}`);
        logger.info(`   After swap: ${tokenOutSymbol} balance: ${ethers.utils.formatUnits(tokenOutBalanceAfter, tokenOut.decimals)}`);
        return txSwap;
    } catch (error) {
        logger.error('  Swap failed:', error);
        throw error;
    }
}