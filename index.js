const { ethers } = require("ethers");
const { checkPoolLiquidity } = require("./bridgeUtils");
require("dotenv").config();

// Configuration
const RPC_URL = process.env.RPC_SOURCE;
const TARGET_POOL = "0x4B8251e7c80F910305bb81547e301DcB8A596918"; 
const DESTINATION = process.env.DESTINATION_ADDRESS;

// --- PRIVATE KEY CLEANER ---
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
        // 1. Check Pool Liquidity
        // Ensure TARGET_POOL is a contract, not a wallet, to avoid "could not decode" errors
        const liquidity = await checkPoolLiquidity(TARGET_POOL, provider);
        console.log(`Target Pool Liquidity: ${liquidity}`);

        // 2. Check Wallet Balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`Current Wallet Balance: ${ethers.formatEther(balance)} ETH`);

        const threshold = BigInt(process.env.MIN_LIQUIDITY_USD);

        // 3. Logic: Sweep if liquidity is too low
        if (BigInt(liquidity) < threshold && balance > ethers.parseEther("0.002")) {
            console.warn("⚠️ LOW LIQUIDITY DETECTED. Sweeping funds...");

            const feeData = await provider.getFeeData();
            const gasLimit = 21000n;
            const totalGasCost = feeData.gasPrice * gasLimit;
            const amountToSend = balance - (totalGasCost * 2n);

            if (amountToSend > 0n) {
                const tx = await wallet.sendTransaction({
                    to: DESTINATION,
                    value: amountToSend,
                    gasLimit: gasLimit
                });
                console.log(`✅ Sweep Transaction Sent: ${tx.hash}`);
                await tx.wait();
            }
        } else {
            console.log("✅ System Idle: Liquidity is stable or balance is low.");
        }
    } catch (error) {
        console.error("❌ System Error:", error.message);
    }
}

// Start the loop
runSystem();
setInterval(runSystem, 300000); // Runs every 5 minutes
