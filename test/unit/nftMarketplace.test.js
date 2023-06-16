const { network, ethers, getNamedAccounts, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { assert } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("NFT Marketplace Tests", () => {
      let nftMarketplace, basicNft, deployer, player
      const PRICE = ethers.utils.parseEther("0.1")
      const TOKEN_ID = 0
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        const accounts = await ethers.getSigners()
        player = accounts[1]
        await deployments.fixture(["all"])
        // the connection implicitly happens with the deployer if not specified along with ethers.getContract method
        nftMarketplace = await ethers.getContract("NFTMarketplace")
        basicNft = await ethers.getContract("BasicNFT")
        await basicNft.mintNft() // deployer is minting the NFT
        await basicNft.approve(nftMarketplace.address, TOKEN_ID) // deployer is approving the basic NFT - approval is only granted by the NFT owner, which in this case is the deployer itself. Only when the approval is called then the marketplace can call transfer from on this NFT i.e., basic NFT.
      })

      it("lists and can be bought", async () => {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
        const playerConnectedNftMarketPlace = nftMarketplace.connect(player)
        await playerConnectedNftMarketPlace.buyItem(
          basicNft.address,
          TOKEN_ID,
          { value: PRICE }
        )
        const newOwner = await basicNft.ownerOf(TOKEN_ID)
        const deployerProceed = await nftMarketplace.getProceeds(deployer)
        assert(newOwner.toString() == player.address)
        assert(deployerProceed.toString() == PRICE.toString())
      })
    })
