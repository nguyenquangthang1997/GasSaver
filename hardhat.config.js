require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-web3");
const fs = require("fs");
// const mnemonic = fs.readFileSync("../.secret").toString().trim();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async () => {
//   const accounts = await ethers.getSigners();

//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  // networks: {
  //   hardhat: {
  //     accounts: { mnemonic: mnemonic },
  //   },
  //   kovan: {
  //     url: `https://kovan.infura.io/v3/6d7d276d251d4f8cb9a66e916ff48508`,
  //     network_id: 42, // Ropsten's id
  //     gas: 7000000, // Ropsten has a lower block limit than mainnet
  //     confirmations: 2, // # of confs to wait between deployments. (default: 0)
  //     timeoutBlocks: 2000000, // # of blocks before a deployment times out  (minimum/default: 50)
  //     skipDryRun: true,
  //     accounts: { mnemonic: mnemonic },
  //   },
  //   bnb: {
  //     url: `https://data-seed-prebsc-1-s2.binance.org:8545`,
  //     network_id: 97,
  //     confirmations: 2,
  //     gas: 20000000,
  //     timeoutBlocks: 20000000,
  //     skipDryRun: true,
  //     accounts: { mnemonic: mnemonic },
  //   },
  //   bnbMainNet: {
  //     url: `https://bsc-dataseed.binance.org`,
  //     network_id: 56,
  //     confirmations: 1,
  //     gas: 20000000,
  //     timeoutBlocks: 20000000,
  //     skipDryRun: true,
  //     accounts: { mnemonic: mnemonic },
  //   },
  //   ethMainNet: {
  //     url: `https://mainnet.infura.io/v3/1208f1211f644fa8ad244bb6d36e6575`,
  //     network_id: 1, // Ropsten's id
  //     gas: 7000000, // Ropsten has a lower block limit than mainnet
  //     confirmations: 2, // # of confs to wait between deployments. (default: 0)
  //     timeoutBlocks: 2000000, // # of blocks before a deployment times out  (minimum/default: 50)
  //     skipDryRun: true,
  //     accounts: { mnemonic: mnemonic },
  //   },
  // },
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          // See the solidity docs for advice about optimization and evmVersion
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.4.18",
        settings: {
          // See the solidity docs for advice about optimization and evmVersion
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          evmVersion: "istanbul",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  etherscan: {
    apiKey: "Y3QVTPHEE9MRN36I71RGAGBZ35H77VJ8B5", //bnb
    // apiKey: "PAJ2TIU2TYP92YT2C53W898IC1YTIJ2KVX",// kovan
  },
  paths: {
    artifacts: "./artifacts",
  },
};
