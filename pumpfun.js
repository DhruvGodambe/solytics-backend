const { Connection, PublicKey } = require('@solana/web3.js');
const fetch = require('node-fetch');
const { Metaplex, token } =  require("@metaplex-foundation/js");

// Connect to the Solana mainnet
const connection = new Connection('https://multi-magical-frost.solana-mainnet.quiknode.pro/3185adc05cf6a6a71925659164c2328ffe800551', 'confirmed');
const metaplex = Metaplex.make(connection);

const programId = new PublicKey('TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM');
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');


const monitorPumpFun = async () => {

    // connection.onProgramAccountChange(programId, async (logInfo) => {

    // });

    connection.onLogs(programId, async (logInfo) => {
        const { signature, logs } = logInfo;
      
        // Fetch the transaction details
        const transaction = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
      
        if (transaction) {
        //   console.log({signature, transaction: { logMessages: transaction.meta.logMessages }})
          console.log(signature)
    
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
    
        //   if(createTx) {
              // Iterate over each instruction in the transaction
              const pumpToken = message.staticAccountKeys[1];
        
              
              const metadata = await metadataWithMetaplex(pumpToken.toString());
              console.log("token found: ", pumpToken.toString())
              if(metadata.name) {
                console.log("name: ", metadata.name);
                console.log("symbol: ", metadata.symbol);
                console.log("image: ", metadata.json.image);
                console.log("description: ", metadata.json.description);
              } else {
                console.log("metadata not found", metadata);
              }
        //   } else {
        //     console.log("not create tx: ", signature);
        //   }
      
        }
        console.log("-----------------------------------")
      });
}

const metadataWithMetaplex = async (tokenAddress) => {
    const token_mint_address = new PublicKey(tokenAddress);

    const metadataAccount = await metaplex
        .nfts()
        .pdas()
        .metadata({ mint: token_mint_address });

    const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

    if (metadataAccountInfo) {
        const token = await metaplex.nfts().findByMint({ mintAddress: token_mint_address });
        tokenName = token.name;
        tokenSymbol = token.symbol;
        tokenLogo = token.json.image;

        return token;
    }

}

// metadataWithMetaplex();

monitorPumpFun().catch(err => {
    console.log(err)
});

  