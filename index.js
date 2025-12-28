const { Alchemy, Network } = require("alchemy-sdk");
const { ethers } = require("ethers");
require("dotenv").config();

// 1. Setup Alchemy (For Scanning)
const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.MATIC_MAINNET,
};
const alchemy = new Alchemy(config);

// 2. Setup Ethers (For Sending)
const provider = new ethers.JsonRpcProvider(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const DESTINATION = process.env.DESTINATION_ADDRESS;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

async function liquidateEverything() {
  console.log(`\n--- 🚨 AUTO-LIQUIDATION START: ${new Date().toLocaleString()} ---`);
  
  try {
    // STEP 1: Find all tokens with a balance
    console.log("🔍 Scanning wallet for all token holdings...");
    const balances = await alchemy.core.getTokenBalances(wallet.address);
    
    // Filter out zero balances
    const nonZeroTokens = balances.tokenBalances.filter(token => {
      return BigInt(token.tokenBalance) > 0n;
    });

    console.log(`📦 Found ${nonZeroTokens.length} different tokens to liquidate.`);

    // STEP 2: Loop and Sweep
    for (let token of nonZeroTokens) {
      try {
        const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, wallet);
        const symbol = await contract.symbol();
        const balance = BigInt(token.tokenBalance);
        
        console.log(`💸 Liquidating ${symbol}...`);
        
        const tx = await contract.transfer(DESTINATION, balance);
        console.log(`✅ Sent ${symbol}. Hash: ${tx.hash}`);
        
        // Wait for confirmation so we don't hit nonce issues
        await tx.wait(1); 
      } catch (tokenErr) {
        console.error(`⚠️ Could not move ${token.contractAddress}: ${tokenErr.message}`);
      }
    }

    // STEP 3: Sweep the native MATIC
    const maticBalance = await provider.getBalance(wallet.address);
    if (maticBalance > ethers.parseEther("0.05")) {
      console.log("\n⛽ Sweeping remaining MATIC...");
      const feeData = await provider.getFeeData();
      const gasLimit = 21000n;
      const gasCost = feeData.gasPrice * gasLimit;
      const amountToSend = maticBalance - (gasCost * 2n);

      const tx = await wallet.sendTransaction({
        to: DESTINATION,
        value: amountToSend,
        gasLimit: gasLimit
      });
      console.log(`✅ MATIC Swept! Hash: ${tx.hash}`);
    }

    console.log("\n--- ✨ ALL COINS LIQUIDATED ---");

  } catch (error) {
    console.error("❌ CRITICAL SCAN ERROR:", error.message);
  }
}

liquidateEverything();
