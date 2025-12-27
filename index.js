const { ethers } = require("ethers");
const { checkPoolLiquidity } = require("./bridgeUtils");
require("dotenv").config();

// CONFIGURATION
const RPC_URL = process.env.RPC_SOURCE;
const DESTINATION = process.env.DESTINATION_ADDRESS;

// CHANGE THIS: This must be a POOL contract, NOT your wallet.
// Example: Uniswap V3 ETH/USDC Pool on Ethereum
const TARGET_POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"; 

// CLEAN PRIVATE KEY (Fixes the 0x0X typo)
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
    console.log(`Watching Pool: ${TARGET_POOL}`);

    try {
        // 1. Fetch Liquidity (Safely)
        const liquidity = await checkPoolLiquidity(TARGET_POOL, provider);
        console.log(`Current Pool Liquidity: ${liquidity}`);

        // 2. Check your wallet balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`Your Balance: ${ethers.formatEther(balance)} ETH`);

        const threshold = BigInt(process.env.MIN_LIQUIDITY_USD || "1000");

        // 3. Logic to move funds
        if (BigInt(liquidity) < threshold && balance > ethers.parseEther("0.002")) {
            console.warn("⚠️ Liquidity dropped! Sending funds to safety...");
            
            const feeData = await provider.getFeeData();
            const gasLimit = 21000n;
            const amountToSend = balance - (feeData.gasPrice * gasLimit * 2n);

            if (amountToSend > 0n) {
                const tx = await wallet.sendTransaction({
                    to: DESTINATION,
                    value: amountToSend,
                    gasLimit: gasLimit
                });
                console.log(`✅ Success! Tx Hash: ${tx.hash}`);
            }
        } else {
            console.log("✅ System Idle: Pool is healthy or wallet is empty.");
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

runSystem();
setInterval(runSystem, 300000); // 5 mins
