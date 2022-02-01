const {optimized} = require("./optimize");
const data = require("./data.json");
let uniqueContractData = require("./uniqueContract.json")
const fs = require('fs').promises;

async function main() {
    let listUniqueContract = Object.values(uniqueContractData).map(item => item[0])
    console.log(listUniqueContract.length)
    for (let i = 0; i < listUniqueContract.length; i++) {
        try {
            //145: 0xfa83a2e9928bc5892abb22d056bed533de59ef78
            //169 0xb266d4cc9f416a9503b53beb891cdb8b1e628c1e
            //249 0x03601edc8af4b0439d63eb3a45ed11b01c6975d7
            //348 0x796f525ff1c4f88de4471d718c730343c83e398c
            //601 0xf8da3e40b0aa1a10d68f5557138ebb7d08a5cfea
            //944 0xe12a03aea96dc56fb8007ec54fcfbdd61965d925
            //1215 0x090c752b7b26d3cc382bf532ec9c4403c80d56cf
            //1849 0x27182842e098f60e3d576794a5bffb0777e025d3
            //2672 0x9b8eb8b3d6e2e0db36f41455185fef7049a35cae
            //2689 0xc0a47dfe034b400b47bdad5fecda2621de6c4d95
            //3306 0x922018674c12a7f0d394ebeef9b58f186cde13c1
            // if (listUniqueContract[i] !== "0xd82c61c95b9bfdbc4c245af245185b16f5727dc4") continue;
            // if(i!==11)continue;
            if (i === 145) continue;
            if (i === 169) continue;
            if (i === 249) continue;
            if (i === 348) continue;
            if (i === 601) continue;
            if (i === 944) continue;
            if (i === 1215) continue;
            if (i === 1849) continue;
            if (i === 2672) continue;
            if (i === 2689) continue;
            if (i === 3306) continue;
            console.log(i, listUniqueContract[i])

            let startTime = Date.now()
            let content;
            for (let file of data[listUniqueContract[i]]) {
                if (content === undefined) {
                    content = await fs.readFile("./verified-contracts-ethereum/contract-data/" + file)
                } else {
                    content = Buffer.concat([content, await fs.readFile("./verified-contracts-ethereum/contract-data/" + file)])
                }
            }
            let results = await optimized(content)
            let writeData = {time: Date.now() - startTime, results}
            if (results.length > 0) {
                await fs.writeFile("results/" + listUniqueContract[i] + ".json", JSON.stringify(writeData))
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
