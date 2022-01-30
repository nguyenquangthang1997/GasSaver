const {addLog, logStateDataArrangement} = require("../log");
const {packDataArrangement} = require("../services/packDataArrangement")

 function stateDataArrangement(item, data) {
    let startTime = Date.now()
    let listStateInContract = item.subNodes.filter(item => item.type === "StateVariableDeclaration")
    let result = packDataArrangement(listStateInContract.map(item => item.variables[0]))
    if (result.status === true) {
        return addLog(item.name, Date.now() - startTime, logStateDataArrangement(result.rangeBefore, result.rangeAfter, data))
    }
}

module.exports = {stateDataArrangement}