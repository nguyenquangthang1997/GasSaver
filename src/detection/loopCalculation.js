const {addLog, logLoopCalculation} = require("../log");

 function loopCalculation(listAllFunction, vul, item, data) {
    let startTime = Date.now()
    if (vul.functionCall.length !== 0) {
        for (let func of listAllFunction) {
            if (vul.functionCall === func.name) {
                let isVul = func.stateMutability === "pure"
                if (isVul) {
                    return addLog(item.name, Date.now() - startTime, logLoopCalculation(vul.range, data, vul.loc))
                }
            }
        }

    } else return addLog(item.name, Date.now() - startTime, logLoopCalculation(vul.range, data, vul.loc))
}

module.exports = {loopCalculation}