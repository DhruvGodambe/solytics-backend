import { Connection, PublicKey, KeyedAccountInfo, SolanaJSONRPCError } from '@solana/web3.js';
import { LIQUIDITY_STATE_LAYOUT_V4, LiquidityStateV4, MAINNET_PROGRAM_ID } from '@raydium-io/raydium-sdk';
import { ClmmRpcData } from "@raydium-io/raydium-sdk-v2";
import dotenv from 'dotenv';
import WebSocket from 'ws';
dotenv.config();


// Solana RPC endpoint
const RPC_ENDPOINT = process.env.RPC_URL || "";
const connection = new Connection(RPC_ENDPOINT, { 
    commitment: 'confirmed',
    wsEndpoint: process.env.WSS_RPC_URL
});

// Raydium Liquidity Program IDs
const raydiumLiquidityProgramIdAmm = MAINNET_PROGRAM_ID.AmmV4; // AMM contract
const raydiumLiquidityProgramIdClmm = MAINNET_PROGRAM_ID.CLMM; // CLMM contract
// const raydiumLiquidityProgramIdCpmm = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"); // CLMM contract

let existingLiquidityPools = new Set<string>();

// Current timestamp in seconds
const currentTime = new Date((Date.now()));

const webSocket = new WebSocket(process.env.WSS_RPC_URL || "");

webSocket.addEventListener('open', () => {
    console.log("WebSocket connection opened");
});
webSocket.addEventListener('close', () => {
    console.log("WebSocket connection closed");
});
webSocket.addEventListener('error', (error) => {
    console.error("WebSocket error:", error);
});

let counter = 0;
// Function to start monitoring both liquidity programs
async function startMonitoringPools(): Promise<void> {
    console.log('Starting monitoring for Raydium AMM and CLMM pools...');
    console.log('Raydium AMM Liquidity Program ID:', raydiumLiquidityProgramIdAmm.toString());

    try {
        // Subscribe to AMM contract
        connection.onProgramAccountChange(
            raydiumLiquidityProgramIdAmm, 
            (info) => processRaydiumPoolUpdate(info, 'AMM'), 
            'confirmed',
            [{dataSize: LIQUIDITY_STATE_LAYOUT_V4.span}]
        );

        // Subscribe to CLMM contract
        // connection.onLogs(
        //     raydiumLiquidityProgramIdClmm, 
        //     (info) => processRaydiumClmmPool(info, 'CLMM'), 
        //     'confirmed'
        // );

        // Subscribe to a **specific** pool by its public key
        // connection.onProgramAccountChange(
        //     raydiumLiquidityProgramIdCpmm,
        //     (accountInfo: any) => {
        //         console.log(`[Specific Pool] Update detected for: ${raydiumLiquidityProgramIdCpmm.toString()}`);
        //         processRaydiumPoolUpdate(accountInfo, 'CPMM');
        //     },
        //     'confirmed',
        //     [{ dataSize: LIQUIDITY_STATE_LAYOUT_V4.span }]
        // );

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log('Error setting up monitoring:', error.message);
        } else {
            console.log('Unexpected error while setting up monitoring.');
        }
    }
}

// Function to process pool updates
function processRaydiumPoolUpdate(updatedAccountInfo: any, programType: string): void {
    const { accountId, accountInfo } = updatedAccountInfo;
    
    const now = new Date(Date.now());
    // console.log("Logs subscribe api called at: ", now.getTime()/1000 - currentTime.getTime()/1000, "secs" );
    // console.log("counter: ", counter++);
    if(accountInfo?.data) {
        const poolState: LiquidityStateV4 = LIQUIDITY_STATE_LAYOUT_V4.decode(accountInfo?.data);
        // console.log("account info detected: ", {accountId: accountId.toString()});
        // console.log("token info detected: ", poolState);
        // console.log(`[${programType}] Detected Pool Update for Account:`, accountId.toString());
        evaluateNewPool(accountId, poolState, programType);
    } else if (updatedAccountInfo?.data) {
        const poolState: LiquidityStateV4 = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo?.data);
        console.log("basemint: ", poolState.baseMint.toString());
        if(poolState.baseMint.toString() !== "11111111111111111111111111111111") {
            console.log("update info decoded: ", poolState);
        }
        // console.log(`[${programType}] Detected Pool Update for Account:`, accountId.toString());
        // evaluateNewPool(accountId, poolState, programType);
    }
}

function processRaydiumClmmPool(info: any, programType: string): void {
    const { signature } = info;
    console.log(info);
}

// Function to evaluate and log new liquidity pools
async function evaluateNewPool(accountId: PublicKey, poolState: LiquidityStateV4, programType: string): Promise<void> {
    const poolId = accountId.toString();

    if(programType === 'CPMM') {
        console.log("CPMM detected");
    } else if (programType == 'CLMM') {
        console.log("CLMM detected");
    }

    if(poolState.poolOpenTime?.toNumber()) {

        const poolOpenTime = new Date(poolState.poolOpenTime?.toNumber() * 1000);
        // console.log("pool open for: ", programType);
        
        
        const nowTime = new Date(Date.now() + 60*1000);

        if (poolOpenTime.getTime() > currentTime.getTime() && !existingLiquidityPools.has(poolId)) {
            existingLiquidityPools.add(poolId);
            console.log(`[${programType}] New liquidity pool detected:`, poolId);
            console.log("token: ", poolState.baseMint.toString());
            console.log("pool open time: ", poolOpenTime.getDate() + "/" + poolOpenTime.getMonth(), ", ", poolOpenTime.getHours() + ":" + poolOpenTime.getMinutes());
    
            // logAllPoolProperties(poolState, programType);
        }
    }
}

// Function to log all properties of the liquidity pool
function logAllPoolProperties(poolState: LiquidityStateV4, programType: string): void {
    console.log(`[${programType}] Liquidity Pool Properties:`);
    Object.keys(poolState).forEach(key => {
        console.log(`${key}: ${poolState[key as keyof LiquidityStateV4]}`);
    });
}

// Start monitoring and handle potential errors
startMonitoringPools().catch(error => {
    console.error('Error starting liquidity pool monitoring:', error);
    if (error instanceof SolanaJSONRPCError && error.code === -32015) {
        console.log('Rate limit error detected. Restarting monitoring...');
        setTimeout(() => startMonitoringPools(), 10000); // Wait for 10 seconds before restarting
    }
});