const { ethers } = require("ethers");

async function checkPoolLiquidity(poolAddress, provider) {
    try {
        // Step 1: Check if address has code (is it a contract?)
        const code = await provider.getCode(poolAddress);
        if (code === "0x" || code === "0x0") {
            return "0"; // It's a wallet, liquidity is 0
        }

        // Step 2: Try Uniswap V3 Liquidity call
        const v3Abi = ["function liquidity() view returns (uint128)"];
        const v3Contract = new ethers.Contract(poolAddress, v3Abi, provider);
        const liq = await v3Contract.liquidity();
        return liq.toString();
        
    } catch (e) {
        // Step 3: Fallback for Uniswap V2
        try {
            const v2Abi = ["function getReserves() view returns (uint112, uint112, uint32)"];
            const v2Contract = new ethers.Contract(poolAddress, v2Abi, provider);
            const [reserve0] = await v2Contract.getReserves();
            return reserve0.toString();
        } catch (v2Err) {
            return "0";
        }
    }
}

module.exports = { checkPoolLiquidity };
