const { network, ethers, getNamedAccounts, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("NFT Marketplace Tests", () => {
      let nftMarketplace, basicNft, deployer, player
      const PRICE = ethers.utils.parseEther("0.1")
      const TOKEN_ID = 0
      beforeEach(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]
        player = accounts[1]
        await deployments.fixture(["all"])
        // the connection implicitly happens with the deployer if not specified along with ethers.getContract method
        nftMarketplace = await ethers.getContract("NFTMarketplace")
        basicNft = await ethers.getContract("BasicNFT")
        await basicNft.mintNft() // deployer is minting the NFT
        await basicNft.approve(nftMarketplace.address, TOKEN_ID) // deployer is approving the basic NFT - approval is only granted by the NFT owner, which in this case is the deployer itself. Only when the approval is called then the marketplace can call transfer from on this NFT i.e., basic NFT.
      })
      describe("Listing of NFT through listItem Method", () => {
        it("reverts if the listing price is less than zero", async () => {
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, "-1")
          ).to.be.reverted
        })
        it("reverts if the listing price is equal to zero", async () => {
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, "0")
          ).to.be.revertedWith("NFTMarketplace__PriceMustBeAboveZero")
        })
        // await statements cannot be put inside expect method which is a utility from package chai.
        it("reverts if the listing is done by a non-owner", async () => {
          const playerConnectedNftMarketPlace = nftMarketplace.connect(player)
          await expect(
            playerConnectedNftMarketPlace.listItem(
              basicNft.address,
              TOKEN_ID,
              PRICE
            )
          ).to.be.revertedWith("NFTMarketplace__NotOwner")
        })
        it("reverts if the NFT is already listed in marketplace", async () => {
          const tx = await nftMarketplace.listItem(
            basicNft.address,
            TOKEN_ID,
            PRICE
          )

          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NFTMarketplace__AlreadyListed")
        })
        it("lists for appropriate listing amount", async () => {
          const tx = await nftMarketplace.listItem(
            basicNft.address,
            TOKEN_ID,
            PRICE
          )
          const txReceipt = await tx.wait(1)
          assert.equal(txReceipt.events[0].args.tokenId, "0")
        })
        it("emits an event ItemListed once a NFT is listed to marketplace", async () => {
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.emit(nftMarketplace, "ItemListed")
        })
      })

      describe("Buying NFT through buyItem method", () => {
        it("reverts if the NFT is not listed in the marketplace", async () => {
          await expect(
            nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
          ).to.be.revertedWith("NFTMarketplace__NotListed")
        })
        it("reverts if the value sent to the marketplace is lesser than the NFT sale price", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          await expect(
            nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
              value: ethers.utils.parseEther("0.001"),
            })
          ).to.be.revertedWith("NFTMarketplace__PriceNotEnoughForPurchase")
        })
        it("removes NFT from listing once bought by another user", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          const playerConnectedNftMarketPlace = nftMarketplace.connect(player)
          await playerConnectedNftMarketPlace.buyItem(
            basicNft.address,
            TOKEN_ID,
            { value: PRICE }
          )
          const newOwner = await basicNft.ownerOf(TOKEN_ID)
          const deployerProceed = await nftMarketplace.getProceeds(
            deployer.address
          )
          assert(newOwner.toString() == player.address)
          assert(deployerProceed.toString() == PRICE.toString())
          // NFT got unlisted after being bought
          await expect(
            nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith("NFTMarketplace__NotListed")
        })
        it("emits an event ItemBought once a NFT is purchased", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          const playerConnectedNftMarketPlace = nftMarketplace.connect(player)
          await expect(
            playerConnectedNftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
              value: PRICE,
            })
          ).to.emit(nftMarketplace, "ItemBought")
        })
      })

      describe("cancelListing", function () {
        it("reverts if there is no listing", async function () {
          const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`
          await expect(
            nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith(error)
        })
        it("reverts if anyone but the owner tries to call", async function () {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          nftMarketplace = nftMarketplace.connect(player)
          await basicNft.approve(player.address, TOKEN_ID)
          await expect(
            nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith("NotOwner")
        })
        it("emits event and removes listing", async function () {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          expect(
            await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.emit("ItemCanceled")
          const listing = await nftMarketplace.getListing(
            basicNft.address,
            TOKEN_ID
          )
          assert(listing.price.toString() == "0")
        })
      })

      describe("updateListing", function () {
        it("must be owner and listed", async function () {
          await expect(
            nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NotListed")
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          playerConnectedNftMarketPlace = nftMarketplace.connect(player)
          await expect(
            playerConnectedNftMarketPlace.updateListing(
              basicNft.address,
              TOKEN_ID,
              PRICE
            )
          ).to.be.revertedWith("NotOwner")
        })
        it("reverts if new price is 0", async function () {
          const updatedPrice = ethers.utils.parseEther("0")
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          await expect(
            nftMarketplace.updateListing(
              basicNft.address,
              TOKEN_ID,
              updatedPrice
            )
          ).to.be.revertedWith("NFTMarketplace__PriceMustBeAboveZero")
        })
        it("updates the price of the item", async function () {
          const updatedPrice = ethers.utils.parseEther("0.2")
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          expect(
            await nftMarketplace.updateListing(
              basicNft.address,
              TOKEN_ID,
              updatedPrice
            )
          ).to.emit("ItemListed")
          const listing = await nftMarketplace.getListing(
            basicNft.address,
            TOKEN_ID
          )
          assert(listing.price.toString() == updatedPrice.toString())
        })
      })

      describe("withdrawProceeds", function () {
        it("doesn't allow 0 proceed withdrawls", async function () {
          await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
            "NoProceeds"
          )
        })
        it("withdraws proceeds", async function () {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          nftMarketplace.connect(player)
          await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          })
          nftMarketplace.connect(deployer)

          const deployerProceedsBefore = await nftMarketplace.getProceeds(
            deployer.address
          )
          const deployerBalanceBefore = await deployer.getBalance()
          const txResponse = await nftMarketplace.withdrawProceeds()
          const transactionReceipt = await txResponse.wait(1)
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const gasCost = gasUsed.mul(effectiveGasPrice)
          const deployerBalanceAfter = await deployer.getBalance()

          assert(
            deployerBalanceAfter.add(gasCost).toString() ==
              deployerProceedsBefore.add(deployerBalanceBefore).toString()
          )
        })
      })
    })
