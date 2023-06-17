const { ethers, getNamedAccounts } = require("hardhat")

const PRICE = ethers.utils.parseEther("0.1")

async function mintAndListNft() {
  const { deployer } = await getNamedAccounts()
  const nftMarketplace = await ethers.getContract("NFTMarketplace", deployer)
  const basicNft = await ethers.getContract("BasicNFT", deployer)
  console.log("Minting...")
  const mintTx = await basicNft.mintNft()
  const mintTxReceipt = await mintTx.wait(1)
  const tokenId = mintTxReceipt.events[0].args.tokenId
  console.log("Approving NFT...")

  const approvalTx = await basicNft.approve(nftMarketplace.address, tokenId)
  await approvalTx.wait(1)
  console.log("Listing NFT...")
  const tx = await nftMarketplace.listItem(basicNft.address, tokenId, PRICE)
  await tx.wait(1)
  console.log("Listed the basic NFT successfully!")
}

mintAndListNft()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
