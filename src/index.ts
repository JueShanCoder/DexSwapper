import { ChainId, Token } from '@uniswap/sdk';
import { ethers } from 'ethers';
import { autoSwapTokens } from './ethereum/uniswap';
import logger from './utils/logger';
import { NATIVE_MINT } from '@solana/spl-token';
import { USDCMint } from '@raydium-io/raydium-sdk-v2';
import { PublicKey } from '@solana/web3.js';
import { owner } from './config/raydiumConfig';
import { raydiumSwap } from './solana/amm/swap';

async function uniswapSwap() {
    const chainId = ChainId.MAINNET;
    const provider = new ethers.providers.InfuraProvider('sepolia', process.env.ETHEREUM_JSONRPC_URL);

    const wallet = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY as string, provider);
    const USDT = new Token(chainId, process.env.USDT_ADDRESS as string, 6);
    const mockToken = new Token(chainId, process.env.MOCK_TOKEN_ADDRESS as string, 9);
    logger.info(`[DEX-SWAPPER] Uniswap Swap start..`);
    logger.info(`   USDT Address: ${USDT.address}, Mock Token Address: ${mockToken.address}`);
    const amount = 100;
    logger.info(`   Swapping ${amount} MockToken to USDT`);
    await autoSwapTokens(ethers.utils.parseUnits(amount.toString(), 9), mockToken, USDT, wallet, provider);
    logger.info(`[DEX-SWAPPER] Uniswap Swap done..`);
    logger.info("\n==========================================================\n");
}

async function solanaSwap() {
    const walletAddress: PublicKey = owner.publicKey
    logger.info(`[DEX-SWAPPER] Raydium Swap start..`);
    const SOL_ADDRESS = NATIVE_MINT;
    const USDC_ADDRES = USDCMint;
    // Router swap
    // routeSwap(walletAddress.toBase58(), sourceTokenAddress, targeTokenAddress, 0.02);

    // Directed swap
    // await raydiumSwap(walletAddress.toBase58(),SOL_ADDRESS, USDC_ADDRES, 0.02);
    await raydiumSwap(walletAddress.toBase58(),USDC_ADDRES, SOL_ADDRESS, 3);
    logger.info(`[DEX-SWAPPER] Raydium Swap done..`);
}

// Function to synchronize swaps
async function executeSwaps() {
    try {
        logger.info(`[DEX-SWAPPER] Starting Uniswap and Solana Swap...`);
        
        // First, execute Uniswap swap
        await uniswapSwap();

        // Once Uniswap swap completes, execute Solana swap
        await solanaSwap();

        logger.info(`[DEX-SWAPPER] Both swaps completed successfully.`);
    } catch (error) {
        logger.error(`[DEX-SWAPPER] Error during swaps:`, error);
    }
}

// Call the executeSwaps function to execute swaps in sequence
executeSwaps();