const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const arguments = []

  log("--------------------------------------------------")

  const basicNft = await deploy("BasicNFT", {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmation: network.config.blockConfirmations || 1,
  })

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verfying....")
    await verify(basicNft.address, arguments)
  }

  log("--------------------------------------------------")
}

module.exports.tags = ["all", "basicnft"]
