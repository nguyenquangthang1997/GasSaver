const parser = require('@solidity-parser/parser');

const {getAllFunction, isGreater} = require("./src/services/handleData")
const {loopCalculation} = require("./src/detection/loopCalculation");
const {loopDuplication} = require("./src/detection/loopDuplication");
const {deMorganCondition} = require("./src/detection/deMorganCondition");
const {stateDataArrangement} = require("./src/detection/stateDataArrangement");
const {structDataArrangement} = require("./src/detection/structDataArrangement");
const {externalFunction} = require("./src/detection/externalFunction");
const {restrictVariableModification} = require("./src/detection/restrictVariableModification");

async function optimized(data) {
    const ast = parser.parse(data.toString(), {tokens: true, tolerant: true, range: true, loc: true});
    let results = [];
    let listInheritedContract = {}
    let sol_version = ""
    ast.children.forEach(el => {
        if (el.type === "ContractDefinition") {
            el.baseContracts.forEach(cntr => {
                listInheritedContract[cntr.baseName.namePath] = true
            })
        } else if (el.type === "PragmaDirective") {
            if (sol_version !== "") {
                let newVersion = el.value.replace("^", "")
                if (isGreater(newVersion, sol_version) === true) sol_version = newVersion

            } else sol_version = el.value.replace("^", "")
        }
    })
    if (sol_version === "") {
        sol_version = "0.0.0"
    }
    ast.children.forEach((item, index) => {
            if (item.type === "ContractDefinition") {
                let listAllFunction = getAllFunction(ast, item.name)
                item.vulnerabilities.forEach(vul => {
                    if (vul.type === "de-morgan") {
                        results.push(deMorganCondition(vul, item, data))
                    } else if (vul.type === "repeated-calculate") {
                        let result = loopCalculation(listAllFunction, vul, item, data)
                        if (result !== undefined) results.push(result)
                    } else if (vul.type === "merge-loop") {
                        let result = loopDuplication(vul, item, data)
                        if (result !== undefined) results.push(result)
                    }
                })
            }
        }
    )

    return results
}

module.exports = {optimized}