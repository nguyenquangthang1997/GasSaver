const parser = require('@solidity-parser/parser');
const fs = require('fs').promises;

let typeMappings = {
    PragmaDirective: 'pragma',
};

function add(data) {
    let temp = "";
    data.forEach((item) => {
        temp += " " + item;
    })
    return temp += "\n";
}

async function run() {
    const data = await fs.readFile("contracts/orai.sol");
    const ast = parser.parse(data.toString(), {loc: true, tokens: true});
    let a = 1;
    let temp = "";
    let array;
    ast.tokens.forEach((token, index) => {
        if (index > 0 && token.loc.start.line > ast.tokens[index - 1].loc.start.line) {
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