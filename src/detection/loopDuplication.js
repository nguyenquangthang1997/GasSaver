const {addLog, logLoopDuplication} = require("../log");

function loopDuplication(vul, item, data) {
    let startTime = Date.now()
    let listLoop = {}
    let result
    for (let i in vul.initExpressionRange) {
        let loopString = data.slice(vul.initExpressionRange[i][0], vul.initExpressionRange[i][1] + 1) + data.slice(vul.conditionExpressionRange[i][0], vul.conditionExpressionRange[i][1] + 1) + data.slice(vul.loopExpressionRange[i][0], vul.loopExpressionRange[i][1] + 1)
        if (listLoop[loopString] === undefined) {
            listLoop[loopString] = {
                range: [vul.range[i]],
                loc: [vul.loc[i]]
            }
        } else {
            listLoop[loopString].range.push(vul.range[i]);
            listLoop[loopString].loc.push(vul.loc[i]);
        }
    }
    Object.values(listLoop).forEach(value => {
        if (value.range.length > 1) {
            result = addLog(item.name, Date.now() - startTime, logLoopDuplication(value.range, data, value.loc))
        }
    })
    return result
}

module.exports = {loopDuplication}