const { ethers } = require("ethers");
require("dotenv").config();

// Simple function to check liquidity on a Uniswap V3 Pool
async function checkPoolLiquidity(poolAddress, provider) {
const poolAbi = ["function liquidity() view returns (uint128)"];
const contract = new ethers.Contract(poolAddress, poolAbi, provider);
const liquidity = await contract.liquidity();
return ethers.formatUnits(liquidity, 0);
}

module.exports = { checkPoolLiquidity };
