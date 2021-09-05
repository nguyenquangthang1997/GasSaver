const Static1 = artifacts.require("Static1");
const Static2 = artifacts.require("Static2");
// const Static3 = artifacts.require("Static3");
// const Static4 = artifacts.require("Static4");
// const Static5 = artifacts.require("Static5");

const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const fs1 = require("fs");

const web3 = new Web3(
    "wss://kovan.infura.io/ws/v3/0a65376851f94c5fbfe1f6cfc3cb1c07"
);
// const {getSignature} = require("../config.js");
const mnemonic = fs1.readFileSync("./.secret").toString().trim();

let a = new HDWalletProvider(
    mnemonic,
    `https://data-seed-prebsc-1-s2.binance.org:8545`
);

let addressPrivatekey = {};
Object.entries(a.wallets).forEach((item, index) => {
    addressPrivatekey[item[0]] = item[1].privateKey.toString("hex");
});

contract("statistics", function (accounts) {
    let account1 = accounts[1];
    // let account2 = accounts[2];
    let transaction;
    describe("Test statistics", function () {
        it("Test statistics", async function () {
            let statistics = await Static1.new({from: account1});
            transaction = await statistics.statistics(2,"qwqqq", 3);
            console.log("1. static1 gas using", transaction.receipt.gasUsed, statistics.address)

            statistics = await Static2.new({from: account1});
            transaction = await statistics.statistics("qwqqq",2, 3);
            console.log("3. static2 gas using", transaction.receipt.gasUsed, statistics.address)
            //
            // statistics = await Static3.new({from: account1});
            // transaction = await statistics.statistics();
            // console.log("4. static3 gas using", transaction.receipt.gasUsed, statistics.address)
            //
            // statistics = await Static4.new({from: account1});
            // transaction = await statistics.statistics();
            // console.log("5. static4 gas using", transaction.receipt.gasUsed, statistics.address)
            //
            // statistics = await Static5.new({from: account1});
            // transaction = await statistics.statistics();
            // console.log("6. static5 gas using", transaction.receipt.gasUsed, statistics.address)

        }).timeout(40000000000);
    });
});