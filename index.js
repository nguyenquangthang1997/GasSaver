const parser = require('@solidity-parser/parser');
const fs = require('fs').promises;


function add(data) {
    let temp = "";
    data.forEach((item) => {
        temp += " " + item;
    })
    return temp += "\n";
}

let isCalledFunction = {}


function mulString(number, token) {
    let result = ""
    for (let i = 0; i < number; i++) {
        result += token;
    }
    return result;
}
function getMappingToken(tokens){
    let mappingToken = [''];
    let column = 0;
    for (let i = 0; i < tokens.length; i++) {

        let token = tokens[i];
        if (token.loc.start.line >= mappingToken.length) {
            let mappingTokenLength = mappingToken.length;
            for (let j = 0; j < token.loc.start.line - mappingTokenLength + 1; j++) {
                mappingToken.push("");
                column = 0;
            }
        }
        if (column < token.loc.start.column) {
            mappingToken[token.loc.start.line] += mulString(token.loc.start.column - column, " ");
        }
        mappingToken[token.loc.start.line] += token.value;
        column = token.loc.end.column
    }
    return mappingToken;
}

async function run() {
    const data = await fs.readFile("contracts/vault.sol");
    const ast = parser.parse(data.toString(), {loc: true, tokens: true,tolerant:true, range:true});
    let a = 1;
    let temp = "";
    let array;

    let mappingToken = getMappingToken(ast.tokens)
    let c = 0;


// get list function call

    ast.children.forEach((item, index) => {
        if (item.type === "ContractDefinition") {
            item.subNodes.forEach((block, index) => {
                if (block.type === "StructDefinition") {
                    let {status, members} = sort(block.members);
                    if (status) {
                        block.members = members
                    }
                }
                if (block.type === "EventDefinition") {
                    let {status, members} = sort(block.parameters);
                    if (status) {
                        block.members = members
                    }
                }
                if (block.type === "FunctionDefinition") {
                    let flag = false;
                    block.parameters.forEach(param => {
                        if (param.typeName.type === "ArrayTypeName" || param.typeName.type === "UserDefinedTypeName") {
                            flag = true;
                        }
                    })
                    if (isCalledFunction[block.name]) {
                        flag = false
                    }
                    if (flag === true && block.visibility === "public") {
                        block.visibility = "external";
                    }

                    block.body.statements.forEach(statment => {
                        if (statment.expression.type === "FunctionCall" && statment.expression.expression.name === "require" && statment.expression.arguments.length === 2) {
                            statment.expression.arguments[1].value = "1";
                        }
                    })


                }
            })

        }
    })
    ast.tokens.forEach((token, index) => {

        if (index > 0 && token.loc.start.block > ast.tokens[index - 1].loc.start.block) {
            temp += "\n";
        }
        temp += " " + token.value

    })
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