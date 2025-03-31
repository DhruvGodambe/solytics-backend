"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Solana RPC endpoint
const RPC_ENDPOINT = process.env.RPC_URL || "";
const connection = new web3_js_1.Connection(RPC_ENDPOINT, {
    commitment: 'confirmed',
    wsEndpoint: process.env.WSS_RPC_URL || ""
});
// Raydium Liquidity Program IDs
const raydiumProgramIds = [
    { id: new web3_js_1.PublicKey(raydium_sdk_1.MAINNET_PROGRAM_ID.AmmV4), handler: handleAmmTransaction, type: 'AMM' },
    { id: new web3_js_1.PublicKey(raydium_sdk_1.MAINNET_PROGRAM_ID.CLMM), handler: handleClmmTransaction, type: 'CLMM' },
    { id: new web3_js_1.PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"), handler: handleCpmmTransaction, type: 'CPMM' } // CPMM contract
];
let existingLiquidityPools = new Set();
// Current timestamp in seconds
const currentTime = new Date(Date.now());
const MAX_RETRIES = 5; // Maximum number of retries
const INITIAL_DELAY = 5000; // Initial delay in milliseconds (5 seconds)
let retryCount = 0;
// Function to sleep for a given duration
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Start monitoring pools
function startMonitoringPools() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting monitoring for Raydium AMM, CLMM, and CPMM pools...');
        raydiumProgramIds.forEach(({ id, handler, type }) => {
            console.log(`Listening to program ID: ${id.toBase58()}`);
            if (type === 'AMM') {
                // Use onProgramAccountChange for AMM
                connection.onProgramAccountChange(id, (accountInfo) => handler(accountInfo, 'AMM'), 'confirmed', [{ dataSize: raydium_sdk_1.LIQUIDITY_STATE_LAYOUT_V4.span }]);
            }
            else {
                // Use onLogs for CLMM and CPMM
                connection.onLogs(id, (logInfo) => __awaiter(this, void 0, void 0, function* () {
                    const { signature } = logInfo;
                    const transaction = yield connection.getTransaction(signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0,
                    });
                    if (transaction) {
                        yield handler(transaction, signature); // Route to the appropriate handler
                    }
                }));
            }
        });
    });
}
// Handler for AMM transactions
function handleAmmTransaction(accountInfo, programType) {
    return __awaiter(this, void 0, void 0, function* () {
        const { accountId, accountInfo: info } = accountInfo;
        if (info === null || info === void 0 ? void 0 : info.data) {
            const poolState = raydium_sdk_1.LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
            evaluateNewPool(accountId, poolState, programType);
        }
    });
}
// Handler for CLMM transactions
function handleClmmTransaction(transaction, signature) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
// Handler for CPMM transactions
function handleCpmmTransaction(transaction, signature) {
    return __awaiter(this, void 0, void 0, function* () {
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
            if (log.includes('Create') && (message.staticAccountKeys[13] == "So11111111111111111111111111111111111111112" || message.staticAccountKeys[17] == "So11111111111111111111111111111111111111112")) {
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
    });
}
// Function to evaluate and log new liquidity pools
function evaluateNewPool(accountId, poolState, programType) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const poolId = accountId.toString();
        if ((_a = poolState.poolOpenTime) === null || _a === void 0 ? void 0 : _a.toNumber()) {
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
    });
}
// Handler for rate limit errors
function handleRateLimitError() {
    return __awaiter(this, void 0, void 0, function* () {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
            console.error('Max retries reached. Restarting script...');
            retryCount = 0;
            yield sleep(INITIAL_DELAY);
            startMonitoringPools();
        }
        else {
            const delay = INITIAL_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff
            console.log(`Retrying after ${delay}ms delay...`);
            yield sleep(delay);
        }
    });
}
// Error handling and retry logic
startMonitoringPools().catch((error) => __awaiter(void 0, void 0, void 0, function* () {
    console.error('Error starting liquidity pool monitoring:', error);
    if (error.message.includes('429 Too Many Requests')) {
        console.error('Rate limit error detected. Retrying after delay...');
        yield handleRateLimitError();
    }
    else {
        console.error('Unexpected error. Restarting script...');
        yield sleep(INITIAL_DELAY);
        startMonitoringPools();
    }
}));
