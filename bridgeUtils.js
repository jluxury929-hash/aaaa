const { ethers } = require("ethers");

async function checkPoolLiquidity(poolAddress, provider) {
    try {
        // SAFETY CHECK: Ensure the address is a contract, not a wallet
        const code = await provider.getCode(poolAddress);
        if (code === "0x" || code === "0x0") {
            throw new Error(`Address ${poolAddress} is an EOA (Wallet), not a Pool Contract.`);
        }

        // ABI for Uniswap V3 Pools
        const abi = ["function liquidity() view returns (uint128)"];
        const contract = new ethers.Contract(poolAddress, abi, provider);
        
        // Try calling the liquidity function
        const liq = await contract.liquidity();
        return liq.toString();
        
    } catch (e) {
        // If V3 fails, could be a V2 pool (different function name)
        try {
            const v2Abi = ["function getReserves() view returns (uint112, uint112, uint32)"];
            const v2Contract = new ethers.Contract(poolAddress, v2Abi, provider);
            const [reserve0] = await v2Contract.getReserves();
            return reserve0.toString();
        } catch (v2Error) {
            console.error(`❌ Could not read liquidity from ${poolAddress}: ${e.message}`);
            return "0";
        }
    }
}

module.exports = { checkPoolLiquidity };
