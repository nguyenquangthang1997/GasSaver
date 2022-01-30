const {addLog, logDemorganCondition} = require("../log");

function deMorganCondition(vul, item, data) {
    let startTime = Date.now()
    return addLog(item.name, Date.now() - startTime, logDemorganCondition(vul.range, data, vul.loc))
}

module.exports = {deMorganCondition}