const {addLog, logLoopDuplication} = require("../log");

function loopDuplication(vul, item, data) {
    let startTime = Date.now()
    if(vul.initExpressionRange.length===2){['0x0901f6530fe9b2ff3e50dc62b70e6bcb79c8b1ba']
        if(data.slice(vul.initExpressionRange[0][0],vul.initExpressionRange[0][1]).toString() !== data.slice(vul.initExpressionRange[1][0],vul.initExpressionRange[1][1]).toString()) return;
    }
    if(vul.conditionExpressionRange.length===2){
        if(data.slice(vul.conditionExpressionRange[0][0],vul.conditionExpressionRange[0][1]).toString() !== data.slice(vul.conditionExpressionRange[1][0],vul.conditionExpressionRange[1][1]).toString()) return;
    }
    if(vul.loopExpressionRange.length===2){
        if(data.slice(vul.loopExpressionRange[0][0],vul.loopExpressionRange[0][1]).toString() !== data.slice(vul.loopExpressionRange[1][0],vul.loopExpressionRange[1][1]).toString()) return;
    }

    return addLog(item.name,Date.now() - startTime, logLoopDuplication(vul.range, data, vul.loc))

    // for (let i in vul.initExpressionRange) {
    //     let loopString = data.slice(vul.initExpressionRange[i][0], vul.initExpressionRange[i][1] + 1) + data.slice(vul.conditionExpressionRange[i][0], vul.conditionExpressionRange[i][1] + 1) + data.slice(vul.loopExpressionRange[i][0], vul.loopExpressionRange[i][1] + 1)
    //     if (listLoop[loopString] === undefined) {
    //         listLoop[loopString] = {
    //             range: [vul.range[i]],
    //             loc: [vul.loc[i]]
    //         }
    //     } else {
    //         listLoop[loopString].range.push(vul.range[i]);
    //         listLoop[loopString].loc.push(vul.loc[i]);
    //     }
    // }
    // Object.values(listLoop).forEach(value => {
    //     if (value.range.length > 1) {
    //         result = addLog(item.name, Date.now() - startTime, logLoopDuplication(value.range, data, value.loc))
    //     }
    // })
    // return result
}

module.exports = {loopDuplication}