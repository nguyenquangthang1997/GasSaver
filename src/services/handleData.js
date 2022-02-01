function traceIdentifier(identifier) {
    if (identifier.type === "Identifier") {
        if (identifier.subIdentifier.type === "IndexAccess") {
            if (identifier.subIdentifier.base.identifiers.length > 0)
                return traceIdentifier(identifier.subIdentifier.base.identifiers[0])
        } else if (identifier.subIdentifier.type === "MemberAccess") {
            if (identifier.subIdentifier.expression.identifiers.length > 0)
                return traceIdentifier(identifier.subIdentifier.expression.identifiers[0])
        } else if (identifier.subIdentifier.type === "IndexRangeAccess") {
            if (identifier.subIdentifier.base.identifiers.length > 0)
                return traceIdentifier(identifier.subIdentifier.base.identifiers[0])
        } else if (identifier.subIdentifier.type === "Common") {
            return identifier.name
        }
    } else {
        console.log("Un-handle", identifier)
        throw  Error("Un-handle")
    }
}

function getAllFunction(ast, contract) {
    let listFunctions = {}
    ast.children.forEach(item => {
        if (item.type === 'ContractDefinition' && item.name === contract) {
            let removeFunctions = {}
            for (let func of item.subNodes) {
                if (func.type === "FunctionDefinition") {
                    listFunctions[func.range.toString()] = func
                    if (func.override !== null) {
                        func.override.forEach(el => {
                            removeFunctions[el.namePath] = true
                        })
                    }
                }
            }
            for (let cntr of item.baseContracts) {
                let listFunctionCntr = getAllFunction(ast, cntr.baseName.namePath)
                listFunctionCntr.forEach(item => {
                    if (removeFunctions[item.name] !== true) {
                        listFunctions[item.range.toString()] = item
                    }
                })
            }
        }
    })
    return Object.values(listFunctions)
}

function getAllModifier(ast, contract) {
    let listModifier = {}
    ast.children.forEach(item => {
        if (item.type === 'ContractDefinition' && item.name === contract) {
            let removeFunctions = {}
            for (let mod of item.subNodes) {
                if (mod.type === "ModifierDefinition") {
                    listModifier[mod.range.toString()] = mod
                    if (mod.override !== null) {
                        mod.override.forEach(el => {
                            removeFunctions[el.namePath] = true
                        })
                    }
                }
            }
            for (let cntr of item.baseContracts) {
                let listModifierCntr = getAllModifier(ast, cntr.baseName.namePath)
                listModifierCntr.forEach(item => {
                    if (removeFunctions[item.name] !== true) {
                        listModifier[item.range.toString()] = item
                    }
                })
            }
        }
    })
    return Object.values(listModifier)
}

function getAllVariableStates(ast, contract) {
    let listStates = {}
    ast.children.forEach(item => {
        if (item.type === 'ContractDefinition' && item.name === contract) {
            for (let state of item.subNodes) {
                if (state.type === "StateVariableDeclaration") {
                    listStates[state.range.toString()] = state
                }
            }
            for (let cntr of item.baseContracts) {
                let listStateCntr = getAllVariableStates(ast, cntr.baseName.namePath)
                for (let stt of listStateCntr) {
                    listStates[stt.range.toString()] = stt
                }
            }
        }
    })
    return Object.values(listStates)
}

module.exports = {traceIdentifier, getAllFunction, getAllModifier, getAllVariableStates}