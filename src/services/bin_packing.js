//{10:["A","B","C"],20:["E","F","G"],1:["H","K"]}
//return size [10,10,20,20,10....]
const fs = require('fs')
let object = {}
let stackResult = {}
let globalNumberStack = 100
let caseMax = []

function bin_packing(array) {
    let result = []
    let arrayCopy;
    if (object[JSON.stringify(array)] !== undefined) {
        return object[JSON.stringify(array)];
    }
    if (array.length === 1) {
        let numberStack = 0;
        let temp = 0;
        for (let i = 0; i < array[0].length; i++) {
            temp += array[0][i];
            if (temp >= 32) {
                temp = temp - 32;
                numberStack++;
            }
        }
        object[JSON.stringify(array)] = [[array[0], numberStack, temp]];
        // stackResult[JSON.stringify(array)] = [parseInt(numberStack), (numberStack - parseInt(numberStack)) * parseInt(32 / array[0])]
        return [[array[0], numberStack, temp]];
    }
    for (let i = 0; i < array.length; i++) {
        arrayCopy = JSON.parse(JSON.stringify(array));
        arrayCopy[i].pop();
        if (arrayCopy[i].length === 0) {
            arrayCopy = arrayCopy.slice(0, i).concat(arrayCopy.slice(i + 1, arrayCopy.length))
        }
        let temppp =  bin_packing(arrayCopy);
        temppp.forEach((item, index) => {
            // console.log(temppp)
            let tempResult;
            if (array[i][0] + item[2] < 32) {
                tempResult = [[array[i][0]].concat(item[0]), item[1], array[i][0] + item[2]];
            } else {
                tempResult = [[array[i][0]].concat(item[0]), item[1] + 1, array[i][0] + item[2] - 32];
            }
            if (tempResult[0].length === 10 && tempResult[1] < globalNumberStack) {
                globalNumberStack = tempResult[1];
                caseMax = tempResult[0];
            }
            result.push(tempResult)
        })
    }
    object[JSON.stringify(array)] = result;
    return result;
}

let c = Date.now()
let a = bin_packing([[8], [1,1], [10,10,10], [20], [32,32],[23]])
console.log( globalNumberStack)
console.log( caseMax)
fs.writeFile('test-address.json', JSON.stringify(a), function (err) {
    if (err) {
        return console.log(err);
    }
    console.log("The file was saved!");
});
console.log(Date.now() - c)


// [[10, 10, 10, 10], [20, 20, 20], [1, 1], [2, 2], [3, 3]]