const { ethers } = require("ethers");
const { checkPoolLiquidity } = require("./bridgeUtils");
require("dotenv").config();

// 1. Validation & Configuration
const RPC_SOURCE = process.env.RPC_SOURCE;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;
const TARGET_POOL = "0x4B8251e7c80F910305bb81547e301DcB8A596918";

// Ensure all environment variables are present
if (!RPC_SOURCE || !PRIVATE_KEY || !DESTINATION_ADDRESS) {
    console.error("ERROR: Missing configuration in .env file (RPC_SOURCE, PRIVATE_KEY, or DESTINATION_ADDRESS)");
    process.exit(1);
}

// Ensure the addresses are valid to avoid the "Invalid ENS" error
if (!ethers.isAddress(TARGET_POOL) || !ethers.isAddress(DESTINATION_ADDRESS)) {
    console.error("ERROR: One of the provided addresses is invalid.");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_SOURCE);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

/**
 * Main function to monitor liquidity and move funds
 */
async function monitorAndSweep() {
    console.log("-----------------------------------------");
    console.log(`Checking status at: ${new Date().toLocaleString()}`);

    try {
        // 1. Check Balance of the monitoring wallet
        const balanceWei = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balanceWei);
        console.log(`Wallet Address: ${wallet.address}`);
        console.log(`Current Balance: ${balanceEth} ETH/Native`);

        // 2. Check Liquidity of the specific pool
        const currentLiquidity = await checkPoolLiquidity(TARGET_POOL, provider);
        console.log(`Pool Liquidity (0x4B82...): ${currentLiquidity}`);

        // 3. Logic: If liquidity is low AND we have funds to move
        const MIN_LIQUIDITY = BigInt(process.env.MIN_LIQUIDITY_USD || "1000"); // Threshold from .env
        
        if (BigInt(currentLiquidity) < MIN_LIQUIDITY && balanceWei > ethers.parseEther("0.005")) {
            console.warn("⚠️ Liquidity too low! Initiating transfer to safe chain...");

            // Calculate amount to send (Current Balance minus gas buffer)
            const feeData = await provider.getFeeData();
            const gasLimit = 21000n; 
            const gasCost = feeData.gasPrice * gasLimit;
            const amountToSend = balanceWei - (gasCost * 2n); // Keeping a small buffer for safety

            if (amountToSend <= 0n) {
                console.log("Insufficient funds to cover gas fees.");
                return;
            }

            const tx = {
                to: DESTINATION_ADDRESS,
                value: amountToSend,
                gasLimit: gasLimit,
                gasPrice: feeData.gasPrice
            };

            console.log(`Sending ${ethers.formatEther(amountToSend)} to ${DESTINATION_ADDRESS}...`);
            const sentTx = await wallet.sendTransaction(tx);
            
            console.log(`✅ Success! Transaction Hash: ${sentTx.hash}`);
            await sentTx.wait(); // Wait for confirmation
        } else {
            console.log("✅ Conditions not met: Liquidity is safe or balance is empty.");
        }

    } catch (error) {
        console.error("❌ Error in monitor loop:", error.message);
    }
}

// Run immediately on start, then every 5 minutes
monitorAndSweep();
setInterval(monitorAndSweep, 300000);
