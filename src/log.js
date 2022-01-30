function logStateDataArrangement(rangeBefore, rangeAfter, data) {
    rangeBefore = rangeBefore.map(item => "\n" + data.slice(item[0], item[1] + 1).toString())
    let _before = rangeBefore.reduce((acc, cur) => {
        return acc.concat(cur)
    })
    rangeAfter = rangeAfter.map(item => data.slice(item[0], item[1] + 1).toString() + "\n")
    let _after = rangeAfter.reduce((acc, cur) => {
        return acc.concat(cur)
    })
    return {
        type: "state-data-arrangement ", before: _before, after: _after
    }
}

function logStructDataArrangement(rangeBefore, rangeAfter, data) {
    rangeBefore = rangeBefore.map(item => "\n" + data.slice(item[0], item[1] + 1).toString())
    let _before = rangeBefore.reduce((acc, cur) => {
        return acc.concat(cur)
    })
    rangeAfter = rangeAfter.map(item => data.slice(item[0], item[1] + 1).toString() + "\n")
    let _after = rangeAfter.reduce((acc, cur) => {
        return acc.concat(cur)
    })
    return {
        type: "struct-data-arrangement ", before: _before, after: _after
    }
}

function logExternalFunction(rangeBefore, endChange, timeReplace, data, visibility) {
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
        type: "external-function ", before: _before, after: _after
    }

}

function logConstantStateModification(range, data, name) {
    let _before = data.slice(range[0], range[1] + 1).toString();
    let _after = data.slice(range[0], range[1] + 1).toString().replace(name, "constant " + name);
    return {
        type: "constant-restrict-modification  ", before: _before, after: _after
    }

}

function logImmutableStateVariable(range, data, name) {
    let _before = data.slice(range[0], range[1] + 1).toString();
    let _after = data.slice(range[0], range[1] + 1).toString().replace(name, "immutable " + name);
    return {
        type: "immutable-restrict-modification ", before: _before, after: _after
    }

}

function logDemorganCondition(range, data, loc) {
    let _before = data.slice(range[0], range[1] + 1).toString();
    let _after = "!(" + data.slice(range[0], range[1] + 1).toString().replace("!", "").replace("!", "") + ")";
    return {
        type: "de-morgan-condition ", before: _before, after: _after, loc
    }

}

function logLoopCalculation(range, data, loc) {
    let _before = data.slice(range[0], range[1] + 1).toString();
    let _after = "// move outside for loop\n" + _before;
    return {
        type: "loop-calculation", before: _before, after: _after, loc
    }

}

function logLoopDuplication(ranges, data, locs) {
    let _before = "";
    for (let i in ranges) {
        _before += `\nstart line ${locs[i].start.line} column ${locs[i].start.column}, end line ${locs[i].end.line} column ${locs[i].end.column}\n` + data.slice(ranges[i][0], ranges[i][1] + 1).toString()
    }
    let _after = "// merge loop\n" + _before;
    return {
        type: "loop-duplication", before: _before, after: _after
    }

}

function addLog(contract, time, data) {
    data.contract = contract
    data.time = time
    return data
}

module.exports = {
    logStateDataArrangement,
    logStructDataArrangement,
    logExternalFunction,
    logConstantStateModification,
    logImmutableStateVariable,
    logDemorganCondition,
    logLoopCalculation,
    logLoopDuplication,
    addLog
}