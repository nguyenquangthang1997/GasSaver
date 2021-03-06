const typeRepresentation = {
    "int8": 8,
    'int16': 16,
    'int24': 24,
    'int32': 32,
    'int40': 40,
    'int48': 48,
    'int56': 56,
    'int64': 64,
    'int72': 72,
    'int80': 80,
    'int88': 88,
    'int96': 96,
    'int104': 104,
    'int112': 112,
    'int120': 120,
    'int128': 128,
    'int136': 136,
    'int144': 144,
    'int152': 152,
    'int160': 160,
    'int168': 168,
    'int176': 176,
    'int184': 184,
    'int192': 192,
    'int200': 200,
    'int208': 208,
    'int216': 216,
    'int224': 224,
    'int232': 232,
    'int240': 240,
    'int248': 248,
    'int256': 256,
    "int": 256,
    "uint8": 8,
    'uint16': 16,
    'uint24': 24,
    'uint32': 32,
    'uint40': 40,
    'uint48': 48,
    'uint56': 56,
    'uint64': 64,
    'uint72': 72,
    'uint80': 80,
    'uint88': 88,
    'uint96': 96,
    'uint104': 104,
    'uint112': 112,
    'uint120': 120,
    'uint128': 128,
    'uint136': 136,
    'uint144': 144,
    'uint152': 152,
    'uint160': 160,
    'uint168': 168,
    'uint176': 176,
    'uint184': 184,
    'uint192': 192,
    'uint200': 200,
    'uint208': 208,
    'uint216': 216,
    'uint224': 224,
    'uint232': 232,
    'uint240': 240,
    'uint248': 248,
    'uint256': 256,
    "uint": 256,
    'byte': 8,
    'bytes': 256,
    'bytes1': 8,
    'bytes2': 16,
    'bytes3': 24,
    'bytes4': 32,
    'bytes5': 40,
    'bytes6': 48,
    'bytes7': 56,
    'bytes8': 64,
    'bytes9': 72,
    'bytes10': 80,
    'bytes11': 88,
    'bytes12': 96,
    'bytes13': 104,
    'bytes14': 112,
    'bytes15': 120,
    'bytes16': 128,
    'bytes17': 136,
    'bytes18': 144,
    'bytes19': 152,
    'bytes20': 160,
    'bytes21': 168,
    'bytes22': 176,
    'bytes23': 184,
    'bytes24': 192,
    'bytes25': 200,
    'bytes26': 208,
    'bytes27': 216,
    'bytes28': 224,
    'bytes29': 232,
    'bytes30': 240,
    'bytes31': 248,
    'bytes32': 256,
    'address': 160,
    'bool': 8,
    'string': 256,
    "default": 256,

}

function packDataArrangement(params) {

    let all256Bit = true;
    let paramsData = []
    for (let param of params) {
        let temp = {}
        if (param.typeName.type === "UserDefinedTypeName") return {status: false}
        temp.type = param.typeName.type !== "ElementaryTypeName" ? "default" : param.typeName.name;
        temp.value = typeRepresentation[temp.type];
        temp.range = [param.typeName.range[0], param.range[1]]
        if (typeRepresentation[temp.type] !== 256) all256Bit = false;
        paramsData.push(temp)
    }
    // let paramsData = params.map(param => {
    //     let temp = {}
    //     temp.type = param.typeName.type !== "ElementaryTypeName" ? "default" : param.typeName.name;
    //     temp.value = typeRepresentation[temp.type];
    //     temp.range = [param.typeName.range[0], param.range[1]]
    //     if (typeRepresentation[temp.type] !== 256) all256Bit = false;
    //     return temp;
    // })

    if (all256Bit === true) return {status: false};
    let result = {}
    result.rangeBefore = paramsData.map(item => item.range)
    let data = optimized(paramsData)
    result.status = data.status;
    result.stack = data.stack;
    result.rangeAfter = paramsData.map(item => item.range)
    return result
}

function compare(a, b) {
    if (a.value > b.value) {
        return -1;
    }
    if (a.value < b.value) {
        return 1;
    }
    return 0;
}

function optimized(data) {
    let currentNumberStack = getNumberStack(data.map(item => item.value))
    data = data.sort(compare);
    let optimizedStack = data.filter(item => item.value === 256)
    data = data.filter(item => item.value !== 256)
    let optimizedResult = {stack: data.map(item => item.value), numberStack: currentNumberStack}
    let input = permutator(data)
    for (let item of input) {
        if (getNumberStack(item) < optimizedResult.numberStack) {
            optimizedResult.stack = item;
            optimizedResult.numberStack = getNumberStack(item);
        }
    }

    for (let bitRep of optimizedResult.stack) {
        for (let i = 0; i < data.length; i++) {
            if (data[i].value === bitRep) {
                optimizedStack.push(data[i])
                data.splice(i, 1)
                break
            }
        }
    }
    optimizedResult.stack = optimizedStack;
    optimizedResult.numberStack = getNumberStack(optimizedResult.stack.map(item => item.value));
    let result = {stack: optimizedResult.stack}
    result.status = optimizedResult.numberStack < currentNumberStack;
    return result;
}

const permutator = (inputArr) => {
    let packValue = inputArr.map(item => item.value)
    let listData = {}
    const getSample = (array) => {
        let result = {}
        if (listData[array] !== undefined) {
            return listData[array]
        }
        if (array.length === 1) {
            listData[array] = [array]
            return [array]
        }
        let childArray = {}
        array.forEach((el, id) => {
            if (childArray[array.slice(0, id).concat(array.slice(id + 1, array.length))] !== undefined) {
                return;
            }
            childArray[array.slice(0, id).concat(array.slice(id + 1, array.length))] = el
            getSample(array.slice(0, id).concat(array.slice(id + 1, array.length))).forEach(item => {
                result[[array[id], ...item].toString()] = [array[id], ...item]
            })
        })

        listData[array] = Object.values(result)
        return Object.values(result)
    }
    let data = getSample(packValue)
    return data

}

function getNumberStack(data) {
    let numberStack = 1;
    let bitInCurrentStack = 0;
    for (let item of data) {
        if (item + bitInCurrentStack > 256) {
            numberStack++
            bitInCurrentStack = item
        } else {
            bitInCurrentStack += item
        }
    }
    return numberStack
}

module.exports = {packDataArrangement}
