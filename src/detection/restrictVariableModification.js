const {getAllModifier, getAllVariableStates, traceIdentifier} = require("../services/handleData");
const {addLog, logImmutableStateVariable, logConstantStateModification} = require("../log");

function restrictVariableModification(ast, item, listAllFunction, data) {
    let startTime = Date.now()
    let stateUseds = {}
    // get all function include inheritance
    listAllFunction.forEach(item => {
            item.stateUsed = []
            let newVariables = {}
            for (let iden of item.identifiers) {
                if (iden.isDeclare === true) newVariables[iden.name] = true
            }
            for (let iden of item.identifiers) {
                //  not declared variable , not modify
                if (iden.isDeclare !== true && !(iden.name in newVariables) && iden.isWriteOperation === true) {
                    let stateUsedName = traceIdentifier(iden)
                    if (stateUsedName in stateUseds) {
                        if (stateUseds[stateUsedName].position === "constructor") {
                            stateUseds[stateUsedName].position = item.isConstructor === true ? "constructor" : "function"
                        }
                    } else {
                        stateUseds[stateUsedName] = {
                            name: iden,
                            position: item.isConstructor === true ? "constructor" : "function"
                        }
                    }

                }
            }
        }
    )
    // get all modifier include inheritance
    let listAllModifier = getAllModifier(ast, item.name)
    listAllModifier.forEach((item, index) => {
        item.stateUsed = []
        let newVariables = {}
        for (let iden of item.identifiers) {
            if (iden.isDeclare === true) newVariables[iden.name] = true
        }
        for (let iden of item.identifiers) {
            if (iden.isDeclare !== true && !(iden.name in newVariables) && iden.name !== "_" && iden.isWriteOperation === true) {
                let stateUsedName = traceIdentifier(iden)
                stateUseds[stateUsedName] = iden
            }
        }
    })

    let results = []

    // get all state include inheritance
    let stateVariableDeclaration = getAllVariableStates(ast, item.name)
    stateVariableDeclaration.forEach((el, index) => {
        if (el.variables[0].isDeclaredConst === false && el.variables[0].typeName.type === "ElementaryTypeName") {
            if (stateUseds[el.variables[0].name] === undefined)
                results.push(addLog(item.name, Date.now() - startTime, logConstantStateModification(el.range, data, el.variables[0].name)))
            else if (stateUseds[el.variables[0].name].position === "constructor" && el.variables[0].isImmutable === false)
                results.push(addLog(item.name, Date.now() - startTime, logImmutableStateVariable(el.range, data, el.variables[0].name)))
        }
    })
    return results
}

module.exports = {restrictVariableModification}