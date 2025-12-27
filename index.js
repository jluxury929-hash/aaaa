const { ethers } = require("ethers");
const { checkPoolLiquidity } = require("./bridgeUtils");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_SOURCE);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Address of the liquidity pool you are monitoring
const TARGET_POOL = "0x4B8251e7c80F910305bb81547e301DcB8A596918";

async function monitorAndSweep() {
console.log("Checking status...");

try {
// 1. Check Liquidity
const currentLiquidity = await checkPoolLiquidity(TARGET_POOL, provider);
console.log(`Current Pool Liquidity: ${currentLiquidity}`);

// 2. Decide if we need to move funds
if (currentLiquidity < process.env.MIN_LIQUIDITY_USD) {
console.warn("Liquidity too low! Initiating cross-chain sweep...");

// 3. Logic to send to Bridge
// For a real production app, you would call Stargate's 'swap' function here
const tx = {
to: process.env.DESTINATION_ADDRESS, // Or Bridge Contract
value: await provider.getBalance(wallet.address) - ethers.parseEther("0.01"), // Leave gas
};

const sentTx = await wallet.sendTransaction(tx);
console.log(`Transaction sent: ${sentTx.hash}`);
} else {
console.log("Liquidity is stable. No action needed.");
}
} catch (error) {
console.error("Error in monitor loop:", error);
}
}

// Run every 5 minutes
setInterval(monitorAndSweep, 300000);
monitorAndSweep();
