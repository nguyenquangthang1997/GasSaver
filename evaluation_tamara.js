const {optimized} = require("./optimize");
const fs = require('fs').promises;


async function main() {

    let listUniqueContract = await fs.readdir('/Users/nguyenquangthang/Documents/visualization/contract-data/tamara');

    for (let i = 0; i < listUniqueContract.length; i++) {
        try {
            console.log(i, listUniqueContract[i])
            let startTime = Date.now()
            let content = await fs.readFile("/Users/nguyenquangthang/Documents/visualization/contract-data/tamara/" + listUniqueContract[i])
            let results = await optimized(content)
            let writeData = {time: Date.now() - startTime, results}
            if (results.length > 0) {
                await fs.writeFile("tamara_results_final/" + listUniqueContract[i].replace("sol", "json"), JSON.stringify(writeData))
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
