const {optimized} = require("./optimize");
const fs = require('fs').promises;


async function main() {

    let listUniqueContract = await fs.readdir('../visualization/contract-data/top-contracts');

    for (let i = 0; i < listUniqueContract.length; i++) {
        try {
            if(i === 4725) continue;
            if(i === 9481) continue;
            console.log(i, listUniqueContract[i])
            let startTime = Date.now()
            let content = await fs.readFile("../visualization/contract-data/top-contracts/" + listUniqueContract[i])
            let results = await optimized(content)
            let writeData = {time: Date.now() - startTime, results}
            if (results.length > 0) {
                await fs.writeFile("./top_contracts_final/" + listUniqueContract[i].replace("sol", "json"), JSON.stringify(writeData))
                console.log("------------------------------------------------------------------------------------------------")
                console.log("------------------------------------------------------------------------------------------------")
                console.log("------------------------------------------------------------------------------------------------")
                console.log("------------------------------------------------------------------------------------------------")
            }
        } catch (e) {
            if (!(e.message === "The specified node does not exist" || e.message === "index parameter must be between >= 0 and <= number of children.")) {
                throw  e
            }
        }

    }
}

main()
