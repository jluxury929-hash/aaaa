const { ethers } = require("ethers");
const { checkPoolLiquidity } = require("./bridgeUtils");
require("dotenv").config();

// CONFIGURATION
const RPC_URL = process.env.RPC_SOURCE;
// This is a REAL Uniswap V3 ETH/USDC Pool address. 
// DO NOT use your own wallet address here.
const TARGET_POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"; 
const DESTINATION = process.env.DESTINATION_ADDRESS;

// 1. CLEAN PRIVATE KEY (Fixes the 0x0X error)
let rawKey = process.env.PRIVATE_KEY || "";
if (rawKey.startsWith("0x0x") || rawKey.startsWith("0x0X")) {
    rawKey = "0x" + rawKey.substring(4);
} else if (!rawKey.startsWith("0x") && rawKey.length > 0) {
    rawKey = "0x" + rawKey;
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(rawKey, provider);

async function runSystem() {
    console.log("-----------------------------------------");
    console.log(`Checking status at: ${new Date().toLocaleString()}`);
    console.log(`Monitoring Wallet: ${wallet.address}`);

    try {
        // 2. CHECK POOL LIQUIDITY
        const liquidity = await checkPoolLiquidity(TARGET_POOL, provider);
        console.log(`Target Pool Liquidity (Uniswap V3): ${liquidity}`);

        // 3. CHECK WALLET BALANCE
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        console.log(`Current Wallet Balance: ${balanceEth} ETH`);

        const threshold = BigInt(process.env.MIN_LIQUIDITY_USD || "1000");

        // 4. SWEEP LOGIC
        if (BigInt(liquidity) < threshold && balance > ethers.parseEther("0.002")) {
            console.warn("⚠️ ALERT: Pool liquidity is below threshold! Sweeping...");

            const feeData = await provider.getFeeData();
            const gasLimit = 21000n;
            const gasPrice = feeData.gasPrice;
            const totalGasCost = gasPrice * gasLimit;
            
            // Send everything except gas cost (with a small safety buffer)
            const amountToSend = balance - (totalGasCost * 2n);

            if (amountToSend > 0n) {
                const tx = await wallet.sendTransaction({
                    to: DESTINATION,
                    value: amountToSend,
                    gasLimit: gasLimit,
                    gasPrice: gasPrice
                });
                console.log(`✅ Transaction Sent! Hash: ${tx.hash}`);
                await tx.wait();
            }
        } else {
            console.log("✅ Conditions not met for sweep. System waiting...");
        }
    } catch (error) {
        console.error("❌ System Error:", error.message);
    }
}

// Start loop (Every 5 minutes)
runSystem();
setInterval(runSystem, 300000);
