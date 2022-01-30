const {addLog, logStructDataArrangement} = require("../log");
const {packDataArrangement} = require("../services/packDataArrangement")

 function structDataArrangement(item, struct, data) {
    let startTime = Date.now()
    let result = packDataArrangement(struct.members)
    if (result.status === true)
        return addLog(item.name, Date.now() - startTime, logStructDataArrangement(result.rangeBefore, result.rangeAfter, data))
}

module.exports = {structDataArrangement}