import { Connection, PublicKey } from '@solana/web3.js';
import { LIQUIDITY_STATE_LAYOUT_V4, LiquidityStateV4, MAINNET_PROGRAM_ID } from '@raydium-io/raydium-sdk';
import dotenv from 'dotenv';
dotenv.config();

// Solana RPC endpoint
const RPC_ENDPOINT = process.env.RPC_URL || "";
const connection = new Connection(RPC_ENDPOINT, { 
    commitment: 'confirmed',
    wsEndpoint: process.env.WSS_RPC_URL || ""
});

// Raydium Liquidity Program IDs
const raydiumProgramIds = [
    { id: new PublicKey(MAINNET_PROGRAM_ID.AmmV4), handler: handleAmmTransaction, type: 'AMM' }, // AMM contract
    { id: new PublicKey(MAINNET_PROGRAM_ID.CLMM), handler: handleClmmTransaction, type: 'CLMM' }, // CLMM contract
    { id: new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"), handler: handleCpmmTransaction, type: 'CPMM' } // CPMM contract
];

let existingLiquidityPools = new Set<string>();

// Current timestamp in seconds
const currentTime = new Date(Date.now());

const MAX_RETRIES = 5; // Maximum number of retries
const INITIAL_DELAY = 5000; // Initial delay in milliseconds (5 seconds)
let retryCount = 0;

// Function to sleep for a given duration
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start monitoring pools
async function startMonitoringPools(): Promise<void> {
    console.log('Starting monitoring for Raydium AMM, CLMM, and CPMM pools...');
    
    raydiumProgramIds.forEach(({ id, handler, type }) => {
        console.log(`Listening to program ID: ${id.toBase58()}`);
        
        if (type === 'AMM') {
            // Use onProgramAccountChange for AMM
            connection.onProgramAccountChange(
                id,
                (accountInfo) => handler(accountInfo, 'AMM'),
                'confirmed',
                [{ dataSize: LIQUIDITY_STATE_LAYOUT_V4.span }]
            );
        } else {
            // Use onLogs for CLMM and CPMM
            connection.onLogs(id, async (logInfo) => {
                const { signature } = logInfo;
                const transaction = await connection.getTransaction(signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0,
                });

                if (transaction) {
                    await handler(transaction, signature); // Route to the appropriate handler
                }
            });
        }
    });
}

// Handler for AMM transactions
async function handleAmmTransaction(accountInfo: any, programType: string): Promise<void> {
    const { accountId, accountInfo: info } = accountInfo;
    
    if (info?.data) {
        const poolState: LiquidityStateV4 = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
        evaluateNewPool(accountId, poolState, programType);
    }
}

// Handler for CLMM transactions
async function handleClmmTransaction(transaction: any, signature: string): Promise<void> {
    const { transaction: { message }, meta } = transaction;
    for (let log of meta.logMessages) {
        if (log.includes('CreatePool')) {
            console.log(`[CLMM] Detected Pool Creation for Signature: ${signature}`);
            console.log("Token 1: ", message.staticAccountKeys[17]);
            console.log("Token 2: ", message.staticAccountKeys[18]);
            console.log("Pool ID: ", message.staticAccountKeys[2]);
            console.log("-----------------------------------");
        }
    }
}

// Handler for CPMM transactions
async function handleCpmmTransaction(transaction: any, signature: string): Promise<void> {
    const { transaction: { message }, meta } = transaction;
    let isInitializeTx = false;
    let isMint = false;
    let isCreate = false;

    for (let log of meta.logMessages) {
        if (log.includes('MintTo') && message.staticAccountKeys.length >= 17) {
            isMint = true;
        }
        if (log.includes('InitializeAccount3') && message.staticAccountKeys.length >= 17) {
            isInitializeTx = true;
        }

        if(log.includes('Create') && (message.staticAccountKeys[13] == "So11111111111111111111111111111111111111112" || message.staticAccountKeys[17] == "So11111111111111111111111111111111111111112")) {
            // console.log("log: ", log);
            isCreate = true;
        }
    }

    if (isInitializeTx && isMint && isCreate) {
        console.log(`[CPMM] Detected Pool Creation for Signature: ${signature}`);
        console.log("Token 1: ", message.staticAccountKeys[17]);
        console.log("Token 2: ", message.staticAccountKeys[13]);
        console.log("Pool ID: ", message.staticAccountKeys[2]);
        console.log("-----------------------------------");
    }
}

// Function to evaluate and log new liquidity pools
async function evaluateNewPool(accountId: PublicKey, poolState: LiquidityStateV4, programType: string): Promise<void> {
    const poolId = accountId.toString();

    if (poolState.poolOpenTime?.toNumber()) {
        const poolOpenTime = new Date(poolState.poolOpenTime.toNumber() * 1000);
        const nowTime = new Date(Date.now() + 60 * 1000);

        if (poolOpenTime.getTime() > currentTime.getTime() && !existingLiquidityPools.has(poolId)) {
            existingLiquidityPools.add(poolId);
            console.log(`[${programType}] New liquidity pool detected:`, poolId);
            console.log("Token: ", poolState.baseMint.toString());
            console.log("Pool Open Time: ", poolOpenTime.toLocaleString());
            console.log("-----------------------------------");
        }
    }
}

// Handler for rate limit errors
async function handleRateLimitError(): Promise<void> {
    retryCount++;
    if (retryCount > MAX_RETRIES) {
        console.error('Max retries reached. Restarting script...');
        retryCount = 0;
        await sleep(INITIAL_DELAY);
        startMonitoringPools();
    } else {
        const delay = INITIAL_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff
        console.log(`Retrying after ${delay}ms delay...`);
        await sleep(delay);
    }
}

// Error handling and retry logic
startMonitoringPools().catch(async (error) => {
    console.error('Error starting liquidity pool monitoring:', error);
    if (error.message.includes('429 Too Many Requests')) {
        console.error('Rate limit error detected. Retrying after delay...');
        await handleRateLimitError();
    } else {
        console.error('Unexpected error. Restarting script...');
        await sleep(INITIAL_DELAY);
        startMonitoringPools();
    }
});