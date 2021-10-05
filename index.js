const parser = require('@solidity-parser/parser');
const fs = require('fs').promises;

const {wastedInDataRepresentation} = require("./src/services/DataRepresentation")

function log(name, rangeBefore, rangeAfter, data) {

    rangeBefore = rangeBefore.map(item => "\n" + data.slice(item[0], item[1] + 1).toString())
    let code = rangeBefore.reduce((acc, cur) => {
        return acc.concat(cur)
    })
    code += "\n\nto\n\n"
    rangeAfter = rangeAfter.map(item => data.slice(item[0], item[1] + 1).toString() + "\n")
    code += rangeAfter.reduce((acc, cur) => {
        return acc.concat(cur)
    })


    return name + " " + code
}

async function optimized(path) {
    const data = await fs.readFile(path);
    const ast = parser.parse(data.toString(), {tokens: true, tolerant: true, range: true});
    let listFunctions = {}
    let contracts = {}

    ast.children.forEach((item, index) => {
        if (item.type === "ContractDefinition") {
            let results = [];
            // if (item.baseContracts.length !== 0) {
            //     // listFunction = {...listFunction,...optimized()}
            // }
            let listStateInContract = item.subNodes.filter(item => item.type === "StateVariableDeclaration")
            let result = wastedInDataRepresentation(listStateInContract.map(item => item.variables[0]))
            if (result.status === true) {
                results.push(log("wastedInDataRepresentation", result.rangeBefore, result.rangeAfter, data))
            }
            let listStructDefinition = item.subNodes.filter(item => item.type === "StructDefinition")
            listStructDefinition.map(item => wastedInDataRepresentation(item.members)).forEach(item => {
                if (item.status === true) results.push(log("wastedInDataRepresentation", item.rangeBefore, item.rangeAfter, data))
            })

            let listFunction = item.subNodes.filter(item => item.type === "FunctionDefinition")
            listFunctions[item.name] = listFunction.map(item=>{
                let c = 1;
            })

        }
    })

}

optimized("contracts/static.sol")
