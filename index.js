const parser = require('@solidity-parser/parser');
const fs = require('fs').promises;

const {wastedInDataRepresentation} = require("./src/services/DataRepresentation")



function getMappingToken(tokens) {
    let result = {}
    tokens.forEach(token => {
        let start = token.range[0]
        for (let i = token.range[0]; i < token.range[1]; i++) {
            result[i] = token.value[i - start]
        }
    })
    return result;
}

function log(name, rangeBefore, rangeAfter, data) {

    rangeBefore = rangeBefore.map(item => "\n" + data.slice(item[0], item[1] + 1).toString())
    let code = rangeBefore.reduce((acc, cur) => {
        return acc.concat(cur)
    })
    code+="\n\nto\n\n"
    rangeAfter = rangeAfter.map(item => data.slice(item[0], item[1] + 1).toString() + "\n")
    code += rangeAfter.reduce((acc, cur) => {
        return acc.concat(cur)
    })


    console.log(name, code)
}

async function run() {
    const data = await fs.readFile("contracts/vault.sol");
    const ast = parser.parse(data.toString(), {tokens: true, tolerant: true, range: true});
    let a = 1;
    let temp = "";
    let array;

    let mappingToken = getMappingToken(ast.tokens)
    let c = 0;


// get list function call

    ast.children.forEach((item, index) => {
        if (item.type === "ContractDefinition") {
            let listStateInContract = item.subNodes.filter(item => item.type === "StateVariableDeclaration")
            let {
                status,
                rangeBefore,
                rangeAfter,
                stack
            } = wastedInDataRepresentation(listStateInContract.map(item => item.variables[0]))
            if (status === true) {
                log("wastedInDataRepresentation", rangeBefore, rangeAfter, data)

            }

            item.subNodes.forEach((block, index) => {
                if (block.type === "StructDefinition") {
                    let {status, range, stack} = wastedInDataRepresentation(block.members)
                    if (status === true) console.log("wastedInDataRepresentation", range)
                }
                // if (block.type === "EventDefinition") {
                //     let {status} = wastedInDataRepresentation(block.parameters)
                //
                // }
                // if (block.type === "FunctionDefinition") {
                //     let {status} = wastedInDataRepresentation(block.parameters)
                //     // let flag = false;
                //     // block.parameters.forEach(param => {
                //     //     if (param.typeName.type === "ArrayTypeName" || param.typeName.type === "UserDefinedTypeName") {
                //     //         flag = true;
                //     //     }
                //     // })
                //     // if (isCalledFunction[block.name]) {
                //     //     flag = false
                //     // }
                //     // if (flag === true && block.visibility === "public") {
                //     //     block.visibility = "external";
                //     // }
                //     //
                //     // block.body.statements.forEach(statment => {
                //     //     if (statment.expression.type === "FunctionCall" && statment.expression.expression.name === "require" && statment.expression.arguments.length === 2) {
                //     //         statment.expression.arguments[1].value = "1";
                //     //     }
                //     // })
                //
                //
                // }
            })

        }
    })
    // ast.tokens.forEach((token, index) => {
    //
    //     if (index > 0 && token.loc.start.block > ast.tokens[index - 1].loc.start.block) {
    //         temp += "\n";
    //     }
    //     temp += " " + token.value
    //
    // })
    console.log(temp)
}

run()

// try {
//     run()
//     const ast = parser.parse(input)
//     console.log(ast)
// } catch (e) {
//     if (e instanceof parser.ParserError) {
//         console.error(e.errors)
//     }
// }

