import { Connection, PublicKey, KeyedAccountInfo, SolanaJSONRPCError } from '@solana/web3.js';
import { LIQUIDITY_STATE_LAYOUT_V4, LiquidityStateV4, MAINNET_PROGRAM_ID, ClmmPoolInfo } from '@raydium-io/raydium-sdk';

import { Metaplex, token } from "@metaplex-foundation/js";
import dotenv from 'dotenv';
dotenv.config();

// Solana RPC endpoint
const RPC_ENDPOINT = process.env.RPC_URL || "";
const connection = new Connection(RPC_ENDPOINT, { 
    commitment: 'confirmed',
    wsEndpoint: process.env.WSS_RPC_URL
});
const metaplex = Metaplex.make(connection);

// Raydium Liquidity Program IDs
const raydiumLiquidityProgramIdAmm = new PublicKey(MAINNET_PROGRAM_ID.AmmV4); // AMM contract
const raydiumLiquidityProgramIdClmm = new PublicKey(MAINNET_PROGRAM_ID.CLMM); // CLMM contract
const raydiumLiquidityProgramIdCpmm = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"); // CLMM contract


async function startMonitoringPools(): Promise<void> {
    console.log("listening to : ", raydiumLiquidityProgramIdCpmm);
    connection.onLogs(raydiumLiquidityProgramIdCpmm, async (logInfo: any) => {
        const { signature, logs } = logInfo;
        // const signature = "3TvRkeqKR2EwktRHquQB1gGXzky9Y5ZKig347t2M1P734aMHNzLq8jgpZUfWY7A1UoMZ41L31v8ApCbNpJ7CDhdq";
        
        // Fetch the transaction details
        const transaction: any = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });
        
        if (transaction) {
        //   console.log({signature, transaction: { logMessages: transaction.meta.logMessages }})
    
        //   let createTx = false;
        //   for (let logs in transaction.meta.logMessages) {
        //     if(logs == "Program log: Instruction: Create") {
        //         createTx = true;
        //         break;
        //     }
        //   }
        //   console.log("Inner Instructions: ");
    
        //   for (let inst in transaction.meta.innerInstructions[0]) {
        //     let innerInst = inst.instructions;
        //     console.log(inst.index, innerInst);
        //   }
            const { transaction: { message } } = transaction;
        //   console.log({message})
        //   console.log(transaction.meta.logMessages);
            let isInitializeTx = false;
            let isMint = false;
            let isCreate = false;
            for (let log in transaction.meta.logMessages) {
                //InitializeAccount3
                //Create
                //initializeTokenMetadata
                //MintTo
                if(transaction.meta.logMessages[log].includes('MintTo') && message.staticAccountKeys.length >= 17) {
                    // console.log("log: ", log);
                    isMint = true;
                }

                if(transaction.meta.logMessages[log].includes('InitializeAccount3') && message.staticAccountKeys.length >= 17) {
                    // console.log("log: ", log);
                    isInitializeTx = true;
                }

                if(transaction.meta.logMessages[log].includes('Create') && message.staticAccountKeys[13] == "So11111111111111111111111111111111111111112") {
                    // console.log("log: ", log);
                    isCreate = true;
                }
            }

            if(isInitializeTx && isMint) {
                console.log(signature)
                console.log("Create Pool Transaction found!");

                console.log("token found: ", message.staticAccountKeys[17]);
                console.log("token found: ", message.staticAccountKeys[13]);
                console.log("pool id: ", message.staticAccountKeys[2])
                console.log("-----------------------------------")
            }
        //   if(createTx) {
                // Iterate over each instruction in the transaction
                // const pumpToken = message.staticAccountKeys[1];
        
                
                // const metadata: any = await metadataWithMetaplex(pumpToken.toString());
               
        //   } else {
        //     console.log("not create tx: ", signature);
        //   }
        
        }
    })
}

const metadataWithMetaplex = async (tokenAddress: any) => {
    const token_mint_address = new PublicKey(tokenAddress);

    const metadataAccount = await metaplex
        .nfts()
        .pdas()
        .metadata({ mint: token_mint_address });

    const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

    if (metadataAccountInfo) {
        const token: any = await metaplex.nfts().findByMint({ mintAddress: token_mint_address });

        return token;
    }

}

startMonitoringPools().catch(err => {
    console.log("retrying...");  
    setTimeout(() => {
        startMonitoringPools();
    }, 10000);
});