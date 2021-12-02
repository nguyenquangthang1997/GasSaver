const parser = require('@solidity-parser/parser');
const fs = require('fs').promises;

const {wastedInDataRepresentation} = require("./src/services/DataRepresentation")

function logDataRepresentation(rangeBefore, rangeAfter, data) {

    rangeBefore = rangeBefore.map(item => "\n" + data.slice(item[0], item[1] + 1).toString())
    let _before = rangeBefore.reduce((acc, cur) => {
        return acc.concat(cur)
    })

    rangeAfter = rangeAfter.map(item => data.slice(item[0], item[1] + 1).toString() + "\n")
    let _after = rangeAfter.reduce((acc, cur) => {
        return acc.concat(cur)
    })


    return {
        type: "wastedInDataRepresentation ", before: _before, after: _after
    }
}

function logDataTypeFunctionCalldata(rangeBefore, endChange, timeReplace,data, visibility) {
    let _before = data.slice(rangeBefore[0], rangeBefore[1] + 1).toString();
    let _after = data.slice(rangeBefore[0], endChange + 1).toString();
    for (let i = 0; i < timeReplace; i++) {
        _after = _after.replace("memory", "calldata")
    }

    _after += data.slice(endChange + 1, rangeBefore[1] + 1).toString();
    _after = visibility === "public"
        ? _after.replace("public", "external")
        : _after;

    return {
        type: "wastedInDataTypeFunctionCalldata ", before: _before, after: _after
    }

}

function logStateVariable(range, data, name) {
    let _before = data.slice(range[0], range[1] + 1).toString();
    let _after = data.slice(range[0], range[1] + 1).toString().replace(name, "constant " + name);
    return {
        type: "wastedInStateVariable ", before: _before, after: _after
    }

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
            listFunction.forEach((item, index) => {
                item.stateUsed = []
                let newVariables = {}
                for (let iden of item.identifiers) {
                    if (iden.isDeclare === true) newVariables[iden.name] = true
                }
                for (let iden of item.identifiers) {
                    if (iden.isDeclare !== true && !(iden.name in newVariables)) item.stateUsed.push(iden)
                }
            })
            listFunctions[item.name] = listFunction.map(item => {
                let changTypeDataRanges = []
                for (let parameter of item.parameters) {
                    if (parameter.storageLocation === "memory") {
                        changTypeDataRanges.push(parameter.range)
                    }
                }
                if ((item.visibility === "public" || item.visibility === "external") && changTypeDataRanges.length > 0)
                    results.push(logDataTypeFunctionCalldata(item.range, item.parameters[item.parameters.length - 1].range[1], changTypeDataRanges.length, data, item.visibility))
            })
            let listModifier = item.subNodes.filter(item => item.type === "ModifierDefinition")
            listModifier.forEach((item, index) => {
                item.stateUsed = []
                let newVariables = {}
                for (let iden of item.identifiers) {
                    if (iden.isDeclare === true) newVariables[iden.name] = true
                }
                for (let iden of item.identifiers) {
                    if (iden.isDeclare !== true && !(iden.name in newVariables) && iden.name !== "_") item.stateUsed.push(iden)
                }
            })

            let stateUseds = {}
            for (let i of item.subNodes) {
                if (i.type === "FunctionDefinition" || i.type === "ModifierDefinition") {
                    for (let stateUsed of i.stateUsed) {
                        if (!(stateUsed.name in stateUseds)) {
                            stateUseds[stateUsed.name] = stateUsed
                        }
                    }
                }
            }

            let stateVariableDeclaration = item.subNodes.filter(item => item.type === "StateVariableDeclaration")
            stateVariableDeclaration.forEach((item, index) => {
                if (!(item.variables[0].name in stateUseds)) {
                    results.push(logStateVariable(item.range, data, item.variables[0].name))
                }
            })
        }
    })
    for (let res of results) {
        console.log("\n============================================================\n")
        console.log(res.type, "\n-------------------------------------------------------------------\n", res.before, "\n-------------------------------------------------------------------\n", res.after, "\n")
        console.log("\n============================================================\n")

    }
}

optimized("contracts/vault.sol")
