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

function logDataTypeFunctionCalldata(rangeBefore, endChange, timeReplace, data, visibility) {
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

function logDemorgan(range, data, loc) {
    let _before = data.slice(range[0], range[1] + 1).toString();
    let _after = "!(" + data.slice(range[0], range[1] + 1).toString().replace("!", "").replace("!", "") + ")";
    return {
        type: "de-morgan ", before: _before, after: _after, loc
    }

}

function logRepeatedCalculate(range, data, loc) {
    let _before = data.slice(range[0], range[1] + 1).toString();
    let _after = "// move outside for loop\n" + _before;
    return {
        type: "repeated-calculate ", before: _before, after: _after, loc
    }

}

function traceIdentifier(identifier) {
    if (identifier.type === "Identifier") {
        if (identifier.subIdentifier.type === "IndexAccess") {
            return traceIdentifier(identifier.subIdentifier.base)
        } else if (identifier.subIdentifier.type === "MemberAccess") {
            return traceIdentifier(identifier.subIdentifier.expression)
        } else if (identifier.subIdentifier.type === "IndexRangeAccess") {
            return traceIdentifier(identifier.subIdentifier.base)
        } else if (identifier.subIdentifier.type === "Common") {
            return identifier.name
        }
    } else {
        console.log(identifier)
        throw Error("Un-handle")
    }
}

function getAllFunction(ast, contract) {
    let listFunctions = []
    ast.children.forEach(item => {
        if (item.type === 'ContractDefinition' && item.name === contract) {
            let listFunction = item.subNodes.filter(item => item.type === "FunctionDefinition")
            listFunctions.push(...listFunction)
            for (let cntr of item.baseContracts) {
                let listFunctionCntr = getAllFunction(ast, cntr.baseName.namePath)
                listFunctions.push(...listFunctionCntr)
            }
        }
    })
    return listFunctions
}

async function optimized(path) {
    const data = await fs.readFile(path);
    const ast = parser.parse(data.toString(), {tokens: true, tolerant: true, range: true, loc: true});
    let listFunctions = {}
    let contracts = {}
    let results = [];
    ast.children.forEach((item, index) => {
        if (item.type === "ContractDefinition") {
            item.vulnerabilities.forEach(vul => {
                if (vul.type === "de-morgan") {
                    results.push(logDemorgan(vul.range, data, vul.loc))
                }
                if (vul.type === "repeated-calculate") {
                    if (vul.functionCall.length !== 0) {
                        let listFunction = getAllFunction(ast, item.name)
                        for (let func of listFunction) {
                            if (vul.functionCall === func.name) {
                                let isVul = func.stateMutability === "pure" ? true : false
                                if (isVul) {
                                    results.push(logRepeatedCalculate(vul.range, data, vul.loc))
                                }
                            }
                        }

                    } else results.push(logRepeatedCalculate(vul.range, data, vul.loc))
                }
            })
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

            // memory => calldata
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

            // check const
            listFunction.forEach((item, index) => {
                item.stateUsed = []
                let newVariables = {}
                for (let iden of item.identifiers) {
                    if (iden.isDeclare === true) newVariables[iden.name] = true
                }
                for (let iden of item.identifiers) {
                    // không phải là biến được khai  báo, k phải biến trong hàm, và bị thay đổi giá trị
                    if (iden.isDeclare !== true && !(iden.name in newVariables) && iden.isWriteOperation === true) item.stateUsed.push(iden)
                }
            })

            let listModifier = item.subNodes.filter(item => item.type === "ModifierDefinition")
            listModifier.forEach((item, index) => {
                item.stateUsed = []
                let newVariables = {}
                for (let iden of item.identifiers) {
                    if (iden.isDeclare === true) newVariables[iden.name] = true
                }
                for (let iden of item.identifiers) {
                    if (iden.isDeclare !== true && !(iden.name in newVariables) && iden.name !== "_" && iden.isWriteOperation === true) item.stateUsed.push(iden)
                }
            })

            let stateUseds = {}
            for (let i of item.subNodes) {
                if (i.type === "FunctionDefinition" || i.type === "ModifierDefinition") {
                    for (let stateUsed of i.stateUsed) {
                        let stateUsedName = traceIdentifier(stateUsed)
                        if (!(stateUsedName in stateUseds)) {
                            stateUseds[stateUsedName] = stateUsed
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
            // listFunction.forEach(item => {
            //     item.stateUsed = item.stateUsed.filter(identifier => identifier.subIdentifier.type === "Common")
            //     if (item.stateUsed.length > 1) {
            //         let analyticIdentifier = {}
            //         item.stateUsed.forEach(iden => {
            //             if (analyticIdentifier[iden.name] === undefined) {
            //                 analyticIdentifier[iden.name] = [iden]
            //             } else {
            //                 analyticIdentifier[iden.name].push(iden)
            //             }
            //         })
            //         for(let state in analyticIdentifier){
            //             if(analyticIdentifier[state].length>1){
            //                 let c = 1;
            //             }
            //         }
            //     }
            // })


            // de morgan


        }
    })
    for (let res of results) {
        console.log("\n============================================================\n")
        console.log(res.type, res.loc !== undefined ? res.loc : "", "\n-------------------------------------------------------------------\n", res.before, "\n-------------------------------------------------------------------\n", res.after, "\n")
        console.log("\n============================================================\n")

    }
}

optimized("contracts/test.sol")
