const {optimized} = require("./optimize");
const fs = require('fs').promises;

async function main(path) {
    try {
        let content = await fs.readFile(path)
        let startTime = Date.now()
        let results = await optimized(content)
        let writeData = {time: Date.now() - startTime, results}
        if (results.length > 0) {
            console.log(writeData)
        } else {
            console.log("Detection without errors")
        }
    } catch (e) {
        if (!(e.message === "The specified node does not exist" || e.message === "index parameter must be between >= 0 and <= number of children.")) {
            throw  e
        }
    }
}

main("./contracts/vault.sol")
