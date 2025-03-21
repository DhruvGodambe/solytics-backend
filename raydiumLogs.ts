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
    connection.onLogs(raydiumLiquidityProgramIdClmm, async (logInfo: any) => {
        const { signature, logs } = logInfo;
        // const signature = "9aNYo13WSoApHUfJBHU51My7t6wNXjPEJeQr5v7TByNJt3y6rFrRJxVV86A5FsPVRa6PxVrhqfUEQV4JLWqjftn";
        
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
            for (let log in transaction.meta.logMessages) {
                if(transaction.meta.logMessages[log].includes('CreatePool')) {
                    console.log("log: ", log);
                    console.log(signature)
                    console.log("Create Pool Transaction found!");

                    console.log("token found: ", message.staticAccountKeys[17]);
                    console.log("token found: ", message.staticAccountKeys[18]);
                    console.log("pool id: ", message.staticAccountKeys[2])
                    console.log("-----------------------------------")

                }
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