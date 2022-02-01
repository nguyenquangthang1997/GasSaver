const {traceIdentifier} = require("../services/handleData");
const {addLog, logExternalFunction} = require("../log");

function externalFunction(item, listAllFunction, data) {
    if(item.name ==="NFT1155V0"){
    let c = 1}
    let listCallFunction = {}
    listAllFunction.forEach(el => {
        if (el.type === "FunctionDefinition") {
            el.vulnerabilities.forEach(vul => {
                if (vul.type === "list-function-call") {
                    listCallFunction[vul.functionCall] = true
                }
            })
        }
    })
    let results = []
    // memory => calldata
    listAllFunction.map(el => {
        let startTime = Date.now()
        if (el.isConstructor === true) return;
        if (el.body === null) return;
        if (!(el.visibility === "public" || el.visibility === "external")) return;
        let changTypeDataRanges = []
        for (let parameter of el.parameters) {
            if (parameter.storageLocation === "memory") {
                let isChangTypeData = true;
                el.identifiers.forEach(iden => {
                    let idenName = traceIdentifier(iden)
                    if (idenName === parameter.name && iden.isWriteOperation === true) {
                        isChangTypeData = false
                    }
                })
                if (isChangTypeData === true) changTypeDataRanges.push(parameter.range)
            }
        }

        if (changTypeDataRanges.length > 0 && listCallFunction[el.name] !== true && el.body.statements.length > 0)
            results.push(addLog(item.name, Date.now() - startTime, logExternalFunction(el.range, el.parameters[el.parameters.length - 1].range[1], changTypeDataRanges.length, data, item.visibility)))
    })
    return results
}

module.exports = {externalFunction}