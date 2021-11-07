const parser = require('@solidity-parser/parser');
const fs = require('fs').promises;

const {wastedInDataRepresentation} = require("./src/services/DataRepresentation")

function logDataRepresentation(rangeBefore, rangeAfter, data) {

    rangeBefore = rangeBefore.map(item => "\n" + data.slice(item[0], item[1] + 1).toString())
    let code = rangeBefore.reduce((acc, cur) => {
        return acc.concat(cur)
    })
    code += "\n\nto\n\n"
    rangeAfter = rangeAfter.map(item => data.slice(item[0], item[1] + 1).toString() + "\n")
    code += rangeAfter.reduce((acc, cur) => {
        return acc.concat(cur)
    })


    return "wastedInDataRepresentation " + code
}

function logDataTypeFunctionCalldata(rangeBefore, rangeChanges, data, visibility) {
    let code = "wastedInDataTypeFunctionCalldata \n" + data.slice(rangeBefore[0], rangeBefore[1] + 1).toString();
    code += "\n\nto\n\n"
    for (rangeChange of rangeChanges) {
        let tempData = data.slice(rangeChange[0], rangeChange[1] + 1).toString();
        code += data.slice(rangeBefore[0], rangeChange[0]).toString() + tempData.replace("memory", "calldata");
    }
    code += visibility === "public"
        ? data.slice(rangeChanges[rangeChanges.length - 1][1]+1, rangeBefore[1] + 1).toString().replace("public", "external")
        : data.slice(rangeChanges[rangeChanges.length - 1][1]+1, rangeBefore[1] + 1).toString();
    return code;
}

async function optimized(path) {
    const data = await fs.readFile(path);
    const ast = parser.parse(data.toString(), {tokens: true, tolerant: true, range: true});
    let listFunctions = {}
    let contracts = {}
    let results = [];
    ast.children.forEach((item, index) => {
        if (item.type === "ContractDefinition") {

            // if (item.baseContracts.length !== 0) {
            //     // listFunction = {...listFunction,...optimized()}
            // }
            let listStateInContract = item.subNodes.filter(item => item.type === "StateVariableDeclaration")
            let result = wastedInDataRepresentation(listStateInContract.map(item => item.variables[0]))
            if (result.status === true) {
                results.push(logDataRepresentation(result.rangeBefore, result.rangeAfter, data))
            }
            let listStructDefinition = item.subNodes.filter(item => item.type === "StructDefinition")
            listStructDefinition.map(item => wastedInDataRepresentation(item.members)).forEach(item => {
                if (item.status === true) results.push(logDataRepresentation(item.rangeBefore, item.rangeAfter, data))
            })

            let listFunction = item.subNodes.filter(item => item.type === "FunctionDefinition")
            listFunctions[item.name] = listFunction.map(item => {
                let changTypeDataRanges = []
                for (let parameter of item.parameters) {
                    if (parameter.storageLocation === "memory") {
                        changTypeDataRanges.push(parameter.range)
                    }
                }
                if ((item.visibility === "public" || item.visibility === "external") && changTypeDataRanges.length > 0)
                    results.push(logDataTypeFunctionCalldata(item.range, changTypeDataRanges, data, item.visibility))
            })

        }
    })
    for (res of results) {
        console.log(res)
    }
}

optimized("contracts/static.sol")
