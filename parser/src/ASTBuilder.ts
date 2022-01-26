import {ParserRuleContext} from 'antlr4ts'
import {AbstractParseTreeVisitor} from 'antlr4ts/tree/AbstractParseTreeVisitor'
import {ParseTree} from 'antlr4ts/tree/ParseTree'
import * as SP from './antlr/SolidityParser'

import {SolidityVisitor} from './antlr/SolidityVisitor'
import {ParseOptions} from './types'
import * as AST from './ast-types'
import {ErrorNode} from 'antlr4ts/tree/ErrorNode'
import {AssignmentOp, assignmentOpValues, Identifier, Vulnerability} from "./ast-types";

interface SourceLocation {
    start: {
        line: number
        column: number
    }
    end: {
        line: number
        column: number
    }
}

interface WithMeta {
    __withMeta: never
}

type ASTBuilderNode = AST.ASTNode & WithMeta

export class ASTBuilder
    extends AbstractParseTreeVisitor<ASTBuilderNode>
    implements SolidityVisitor<ASTBuilderNode | ASTBuilderNode[]> {
    public result: AST.SourceUnit | null = null
    private _currentContract?: string

    constructor(public options: ParseOptions) {
        super()
    }

    defaultResult(): AST.ASTNode & WithMeta {
        throw new Error('Unknown node')
    }

    aggregateResult() {
        return ({type: ''} as unknown) as AST.ASTNode & WithMeta
    }

    public visitSourceUnit(ctx: SP.SourceUnitContext): AST.SourceUnit & WithMeta {
        const children = (ctx.children ?? []).filter(
            (x) => !(x instanceof ErrorNode)
        )

        const node: AST.SourceUnit = {
            type: 'SourceUnit',
            children: children.slice(0, -1).map((child) => this.visit(child)),
        }
        let vulnerabilities = []
        node.children.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        const result = this._addMeta(node, ctx, vulnerabilities)
        this.result = result

        return result
    }

    public visitContractPart(ctx: SP.ContractPartContext) {
        return this.visit(ctx.getChild(0))
    }

    public visitContractDefinition(
        ctx: SP.ContractDefinitionContext
    ): AST.ContractDefinition & WithMeta {
        const name = ASTBuilder._toText(ctx.identifier())
        const kind = ASTBuilder._toText(ctx.getChild(0))

        this._currentContract = name
        const subNodes = ctx.contractPart().map((x) => this.visit(x))
        const node: AST.ContractDefinition = {
            type: 'ContractDefinition',
            name,
            baseContracts: ctx
                .inheritanceSpecifier()
                .map((x) => this.visitInheritanceSpecifier(x)),
            subNodes: subNodes,
            stateVariable: subNodes.filter(node => node.type === "StateVariableDeclaration"),
            kind,
        }
        let vulnerabilities = []
        node.baseContracts.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        subNodes.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitStateVariableDeclaration(
        ctx: SP.StateVariableDeclarationContext
    ) {
        const type = this.visitTypeName(ctx.typeName())
        const iden = ctx.identifier()
        let identifier = this.visitIdentifier(iden)
        let vulnerabilities = [...type.vulnerabilities, ...identifier.vulnerabilities]
        const name = ASTBuilder._toText(iden)

        let expression: AST.Expression | null = null
        const ctxExpression = ctx.expression()
        if (ctxExpression) {
            expression = this.visitExpression(ctxExpression)
            vulnerabilities.push(...expression.vulnerabilities)
        }

        let visibility: AST.VariableDeclaration['visibility'] = 'default'
        if (ctx.InternalKeyword().length > 0) {
            visibility = 'internal'
        } else if (ctx.PublicKeyword().length > 0) {
            visibility = 'public'
        } else if (ctx.PrivateKeyword().length > 0) {
            visibility = 'private'
        }

        let isDeclaredConst = false
        if (ctx.ConstantKeyword().length > 0) {
            isDeclaredConst = true
        }

        let override
        const overrideSpecifier = ctx.overrideSpecifier()
        if (overrideSpecifier.length === 0) {
            override = null
        } else {
            override = overrideSpecifier[0]
                .userDefinedTypeName()
                .map((x) => this.visitUserDefinedTypeName(x))
            vulnerabilities.push(...override.vulnerabilities)
        }

        let isImmutable = false
        if (ctx.ImmutableKeyword().length > 0) {
            isImmutable = true
        }
        const decl: AST.StateVariableDeclarationVariable = {
            type: 'VariableDeclaration',
            typeName: type,
            name,
            identifier,
            expression,
            visibility,
            isStateVar: true,
            isDeclaredConst,
            isIndexed: false,
            isImmutable,
            override,
            storageLocation: null,
        }
        const node: AST.StateVariableDeclaration = {
            type: 'StateVariableDeclaration',
            variables: [this._addMeta(decl, ctx, vulnerabilities)],
            initialValue: expression,
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitVariableDeclaration(
        ctx: SP.VariableDeclarationContext
    ): AST.VariableDeclaration & WithMeta {
        let storageLocation: string | null = null
        const ctxStorageLocation = ctx.storageLocation()
        if (ctxStorageLocation) {
            storageLocation = ASTBuilder._toText(ctxStorageLocation)
        }

        const identifierCtx = ctx.identifier()

        const node: AST.VariableDeclaration = {
            type: 'VariableDeclaration',
            typeName: this.visitTypeName(ctx.typeName()),
            name: ASTBuilder._toText(identifierCtx),
            identifier: this.visitIdentifier(identifierCtx),
            storageLocation,
            isStateVar: false,
            isIndexed: false,
            expression: null,
        }

        return this._addMeta(node, ctx, [...node.typeName.vulnerabilities, ...node.identifier.vulnerabilities])
    }

    public visitVariableDeclarationStatement(
        ctx: SP.VariableDeclarationStatementContext
    ): AST.VariableDeclarationStatement & WithMeta {
        let identifiers = []
        let vulnerabilites = []
        let variables: Array<AST.VariableDeclaration | null> = []
        const ctxVariableDeclaration = ctx.variableDeclaration()
        const ctxIdentifierList = ctx.identifierList()
        const ctxVariableDeclarationList = ctx.variableDeclarationList()
        if (ctxVariableDeclaration !== undefined) {
            variables = [this.visitVariableDeclaration(ctxVariableDeclaration)]
        } else if (ctxIdentifierList !== undefined) {
            variables = this.buildIdentifierList(ctxIdentifierList)
        } else if (ctxVariableDeclarationList) {
            variables = this.buildVariableDeclarationList(ctxVariableDeclarationList)
        }
        variables.forEach(el => {
            try {
                identifiers.push({...el.identifier, isDeclare: true, isWriteOperation: true});
                vulnerabilites.push(...el.vulnerabilities)
            } catch (e) {
                console.log(e)
            }
        })

        let initialValue: AST.Expression | null = null
        const ctxExpression = ctx.expression()
        if (ctxExpression) {
            initialValue = this.visitExpression(ctxExpression)
            vulnerabilites.push(...initialValue.vulnerabilities)
            identifiers.push(...initialValue.identifiers)
        }
        const node: AST.VariableDeclarationStatement = {
            type: 'VariableDeclarationStatement',
            variables,
            initialValue,
            identifiers
        }

        return this._addMeta(node, ctx, vulnerabilites)
    }

    public visitStatement(ctx: SP.StatementContext) {
        return this.visit(ctx.getChild(0)) as AST.Statement & WithMeta
    }

    public visitSimpleStatement(ctx: SP.SimpleStatementContext) {
        return this.visit(ctx.getChild(0)) as AST.SimpleStatement & WithMeta
    }

    public visitEventDefinition(ctx: SP.EventDefinitionContext) {
        const parameters = ctx
            .eventParameterList()
            .eventParameter()
            .map((paramCtx) => {
                const type = this.visitTypeName(paramCtx.typeName())
                let name: string | null = null
                const paramCtxIdentifier = paramCtx.identifier()
                if (paramCtxIdentifier) {
                    name = ASTBuilder._toText(paramCtxIdentifier)
                }

                const node: AST.VariableDeclaration = {
                    type: 'VariableDeclaration',
                    typeName: type,
                    name,
                    identifier:
                        paramCtxIdentifier !== undefined
                            ? this.visitIdentifier(paramCtxIdentifier)
                            : null,
                    isStateVar: false,
                    isIndexed: paramCtx.IndexedKeyword() !== undefined,
                    storageLocation: null,
                    expression: null,
                }
                let vulnerabilities
                if (node.identifier === null) {
                    vulnerabilities = [...node.typeName.vulnerabilities]
                } else {
                    vulnerabilities = [...node.typeName.vulnerabilities, ...node.identifier.vulnerabilities]
                }
                return this._addMeta(node, paramCtx, vulnerabilities)
            })
        const node: AST.EventDefinition = {
            type: 'EventDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
            parameters,
            isAnonymous: ctx.AnonymousKeyword() !== undefined,
        }
        let vulnerabilities = []
        parameters.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitBlock(ctx: SP.BlockContext): AST.Block & WithMeta {
        let statements = ctx.statement().map((x) => this.visitStatement(x));
        let identifiers = []
        let vulnerabilities = []
        let mergeLoopVulnerability = {
            type: "merge-loop",
            range: [],
            initExpressionRange: [],
            conditionExpressionRange: [],
            loopExpressionRange: [],
            loc: []
        }
        statements.forEach(el => {
            if (el.type === "ForStatement") {
                mergeLoopVulnerability.loc.push(el.loc)
                mergeLoopVulnerability.range.push(el.range)
                mergeLoopVulnerability.initExpressionRange.push(el.initExpression.range)
                mergeLoopVulnerability.conditionExpressionRange.push(el.conditionExpression.range)
                mergeLoopVulnerability.loopExpressionRange.push(el.loopExpression.range)

            }
            identifiers.push(...el.identifiers)
            vulnerabilities.push(...el.vulnerabilities)
        })
        if (mergeLoopVulnerability.range.length > 1) {
            vulnerabilities.push(mergeLoopVulnerability)
        }
        const node: AST.Block = {
            type: 'Block',
            statements,
            identifiers
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitParameter(ctx: SP.ParameterContext) {
        let storageLocation: string | null = null
        const ctxStorageLocation = ctx.storageLocation()
        if (ctxStorageLocation !== undefined) {
            storageLocation = ASTBuilder._toText(ctxStorageLocation)
        }

        let name: string | null = null
        const ctxIdentifier = ctx.identifier()
        if (ctxIdentifier !== undefined) {
            name = ASTBuilder._toText(ctxIdentifier)
        }

        const node: AST.VariableDeclaration = {
            type: 'VariableDeclaration',
            typeName: this.visitTypeName(ctx.typeName()),
            name,
            identifier:
                ctxIdentifier !== undefined
                    ? this.visitIdentifier(ctxIdentifier)
                    : null,
            storageLocation,
            isStateVar: false,
            isIndexed: false,
            expression: null,
        }
        let vulnerabilities = [...node.typeName.vulnerabilities]
        if (node.identifier !== null) vulnerabilities.push(...node.identifier.vulnerabilities)
        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitFunctionDefinition(
        ctx: SP.FunctionDefinitionContext
    ): AST.FunctionDefinition & WithMeta {
        let isConstructor = false
        let isFallback = false
        let isReceiveEther = false
        let isVirtual = false
        let name: string | null = null
        let parameters: any = []
        let returnParameters: AST.VariableDeclaration[] | null = null
        let visibility: AST.FunctionDefinition['visibility'] = 'default'

        let block: AST.Block | null = null
        const ctxBlock = ctx.block()
        let identifiers = []
        if (ctxBlock !== undefined) {
            block = this.visitBlock(ctxBlock)
        }

        const modifiers = ctx
            .modifierList()
            .modifierInvocation()
            .map((mod) => this.visitModifierInvocation(mod))

        let stateMutability = null
        if (ctx.modifierList().stateMutability().length > 0) {
            stateMutability = ASTBuilder._stateMutabilityToText(
                ctx.modifierList().stateMutability(0)
            )
        }

        // see what type of function we're dealing with
        const ctxReturnParameters = ctx.returnParameters()
        switch (ASTBuilder._toText(ctx.functionDescriptor().getChild(0))) {
            case 'constructor':
                parameters = ctx
                    .parameterList()
                    .parameter()
                    .map((x) => this.visit(x))
                parameters.forEach(el => {
                    identifiers.push({...el.identifier, isDeclare: true})
                })
                // error out on incorrect function visibility
                if (ctx.modifierList().InternalKeyword().length > 0) {
                    visibility = 'internal'
                } else if (ctx.modifierList().PublicKeyword().length > 0) {
                    visibility = 'public'
                } else {
                    visibility = 'default'
                }

                isConstructor = true
                break
            case 'fallback':
                visibility = 'external'
                isFallback = true
                break
            case 'receive':
                visibility = 'external'
                isReceiveEther = true
                break
            case 'function': {
                const identifier = ctx.functionDescriptor().identifier()
                name = identifier !== undefined ? ASTBuilder._toText(identifier) : ''

                parameters = ctx
                    .parameterList()
                    .parameter()
                    .map((x) => this.visit(x))

                parameters.forEach(el => {
                    identifiers.push({...el.identifier, isDeclare: true})
                })

                returnParameters =
                    ctxReturnParameters !== undefined
                        ? this.visitReturnParameters(ctxReturnParameters)
                        : null


                // parse function visibility
                if (ctx.modifierList().ExternalKeyword().length > 0) {
                    visibility = 'external'
                } else if (ctx.modifierList().InternalKeyword().length > 0) {
                    visibility = 'internal'
                } else if (ctx.modifierList().PublicKeyword().length > 0) {
                    visibility = 'public'
                } else if (ctx.modifierList().PrivateKeyword().length > 0) {
                    visibility = 'private'
                }

                isConstructor = name === this._currentContract
                isFallback = name === ''
                break
            }
        }

        modifiers.forEach(el => identifiers.push(...el.identifiers))
        if (block !== null && "identifiers" in block) identifiers.push(...block.identifiers)
        if (returnParameters !== null) returnParameters.forEach(el => {
            if (el.identifier !== null) identifiers.push({...el.identifier, isDeclare: true})
        })

        // check if function is virtual
        if (ctx.modifierList().VirtualKeyword().length > 0) {
            isVirtual = true
        }

        let override: AST.UserDefinedTypeName[] | null
        const overrideSpecifier = ctx.modifierList().overrideSpecifier()
        if (overrideSpecifier.length === 0) {
            override = null
        } else {
            override = overrideSpecifier[0]
                .userDefinedTypeName()
                .map((x) => this.visitUserDefinedTypeName(x))
        }

        const node: AST.FunctionDefinition = {
            type: 'FunctionDefinition',
            name,
            parameters,
            returnParameters,
            body: block,
            visibility,
            modifiers,
            override,
            isConstructor,
            isReceiveEther,
            isFallback,
            isVirtual,
            stateMutability,
            identifiers
        }
        let vulnerabilities = []
        parameters.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        modifiers.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        if (returnParameters !== null) returnParameters.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        if (block !== null) vulnerabilities.push(...block.vulnerabilities)
        if (override !== null) override.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitEnumDefinition(
        ctx: SP.EnumDefinitionContext
    ): AST.EnumDefinition & WithMeta {
        const node: AST.EnumDefinition = {
            type: 'EnumDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
            members: ctx.enumValue().map((x) => this.visitEnumValue(x)),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitEnumValue(ctx: SP.EnumValueContext): AST.EnumValue & WithMeta {
        const node: AST.EnumValue = {
            type: 'EnumValue',
            name: ASTBuilder._toText(ctx.identifier()),
        }
        return this._addMeta(node, ctx, [])
    }

    public visitElementaryTypeName(
        ctx: SP.ElementaryTypeNameContext
    ): AST.ElementaryTypeName & WithMeta {
        const node: AST.ElementaryTypeName = {
            type: 'ElementaryTypeName',
            name: ASTBuilder._toText(ctx),
            stateMutability: null,
        }

        return this._addMeta(node, ctx, [])
    }

    public visitIdentifier(ctx: SP.IdentifierContext): AST.Identifier & WithMeta {
        const node: AST.Identifier = {
            type: 'Identifier',
            name: ASTBuilder._toText(ctx),
            identifiers: [{
                type: 'Identifier',
                name: ASTBuilder._toText(ctx),
                identifiers: [],
                subIdentifier: {
                    type: "Common",
                    identifiers: []
                }
            }],
            subIdentifier: {
                type: "Common",
                identifiers: []
            }
        }
        return this._addMeta(node, ctx, [])
    }

    public visitTypeName(ctx: SP.TypeNameContext): AST.TypeName & WithMeta {
        if (ctx.children !== undefined && ctx.children.length > 2) {
            let vulnerabilities = []
            let length = null
            if (ctx.children.length === 4) {
                const expression = ctx.expression()
                if (expression === undefined) {
                    throw new Error(
                        'Assertion error: a typeName with 4 children should have an expression'
                    )
                }
                length = this.visitExpression(expression)
                vulnerabilities.push(...length.vulnerabilities)
            }

            const ctxTypeName = ctx.typeName()

            const node: AST.ArrayTypeName = {
                type: 'ArrayTypeName',
                baseTypeName: this.visitTypeName(ctxTypeName!),
                length,
            }
            vulnerabilities.push(...node.baseTypeName.vulnerabilities)
            return this._addMeta(node, ctx, vulnerabilities)
        }

        if (ctx.children?.length === 2) {
            const node: AST.ElementaryTypeName = {
                type: 'ElementaryTypeName',
                name: ASTBuilder._toText(ctx.getChild(0)),
                stateMutability: ASTBuilder._toText(ctx.getChild(1)),
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.elementaryTypeName() !== undefined) {
            return this.visitElementaryTypeName(ctx.elementaryTypeName()!)
        }

        if (ctx.userDefinedTypeName() !== undefined) {
            return this.visitUserDefinedTypeName(ctx.userDefinedTypeName()!)
        }

        if (ctx.mapping() !== undefined) {
            return this.visitMapping(ctx.mapping()!)
        }

        if (ctx.functionTypeName() !== undefined) {
            return this.visitFunctionTypeName(ctx.functionTypeName()!)
        }

        throw new Error('Assertion error: unhandled type name case')
    }

    public visitUserDefinedTypeName(
        ctx: SP.UserDefinedTypeNameContext
    ): AST.UserDefinedTypeName & WithMeta {
        const node: AST.UserDefinedTypeName = {
            type: 'UserDefinedTypeName',
            namePath: ASTBuilder._toText(ctx),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitUsingForDeclaration(
        ctx: SP.UsingForDeclarationContext
    ): AST.UsingForDeclaration & WithMeta {
        let typeName = null
        let vulnerabilities = []
        const ctxTypeName = ctx.typeName()
        if (ctxTypeName !== undefined) {
            typeName = this.visitTypeName(ctxTypeName)
            vulnerabilities.push(...typeName.vulnerabilities)
        }

        const node: AST.UsingForDeclaration = {
            type: 'UsingForDeclaration',
            typeName,
            libraryName: ASTBuilder._toText(ctx.identifier()),
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitPragmaDirective(
        ctx: SP.PragmaDirectiveContext
    ): AST.PragmaDirective & WithMeta {
        // this converts something like >= 0.5.0  <0.7.0
        // in >=0.5.0 <0.7.0
        const versionContext = ctx.pragmaValue().version()

        let value = ASTBuilder._toText(ctx.pragmaValue())
        if (versionContext?.children !== undefined) {
            value = versionContext.children.map((x) => ASTBuilder._toText(x)).join(' ')
        }

        const node: AST.PragmaDirective = {
            type: 'PragmaDirective',
            name: ASTBuilder._toText(ctx.pragmaName()),
            value,
        }

        return this._addMeta(node, ctx, [])
    }

    public visitInheritanceSpecifier(
        ctx: SP.InheritanceSpecifierContext
    ): AST.InheritanceSpecifier & WithMeta {
        const exprList = ctx.expressionList()
        const args =
            exprList !== undefined
                ? exprList.expression().map((x) => this.visitExpression(x))
                : []

        const node: AST.InheritanceSpecifier = {
            type: 'InheritanceSpecifier',
            baseName: this.visitUserDefinedTypeName(ctx.userDefinedTypeName()),
            arguments: args,
        }
        let vulnerabilities = []
        args.forEach(item => vulnerabilities.push(...item.vulnerabilities))

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitModifierInvocation(
        ctx: SP.ModifierInvocationContext
    ): AST.ModifierInvocation & WithMeta {
        const exprList = ctx.expressionList()

        let args
        let vulnerabilities = []
        let identifiers = []
        if (exprList != null) {
            args = exprList.expression().map((x) => this.visit(x))
            args.forEach(el => {
                identifiers.push(...el.identifiers)
                vulnerabilities.push(...el.vulnerabilities)
            })
        } else if (ctx.children !== undefined && ctx.children.length > 1) {
            args = []
        } else {
            args = null
        }

        const node: AST.ModifierInvocation = {
            type: 'ModifierInvocation',
            name: ASTBuilder._toText(ctx.identifier()),
            arguments: args,
            identifiers
        }
        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitTypeNameExpression(
        ctx: SP.TypeNameExpressionContext
    ): AST.TypeNameExpression & WithMeta {
        const ctxElementaryTypeName = ctx.elementaryTypeName()
        const ctxUserDefinedTypeName = ctx.userDefinedTypeName()
        let typeName

        if (ctxElementaryTypeName !== undefined) {
            typeName = this.visitElementaryTypeName(ctxElementaryTypeName)
        } else if (ctxUserDefinedTypeName !== undefined) {
            typeName = this.visitUserDefinedTypeName(ctxUserDefinedTypeName)
        } else {
            throw new Error(
                'Assertion error: either elementaryTypeName or userDefinedTypeName should be defined'
            )
        }

        const node: AST.TypeNameExpression = {
            type: 'TypeNameExpression',
            typeName,
            identifiers: []
        }

        return this._addMeta(node, ctx, [...typeName.vulnerabilities])
    }

    public visitFunctionTypeName(
        ctx: SP.FunctionTypeNameContext
    ): AST.FunctionTypeName & WithMeta {
        const parameterTypes = ctx
            .functionTypeParameterList(0)
            .functionTypeParameter()
            .map((typeCtx) => this.visitFunctionTypeParameter(typeCtx))

        let returnTypes: AST.VariableDeclaration[] = []
        if (ctx.functionTypeParameterList().length > 1) {
            returnTypes = ctx
                .functionTypeParameterList(1)
                .functionTypeParameter()
                .map((typeCtx) => this.visitFunctionTypeParameter(typeCtx))
        }

        let visibility = 'default'
        if (ctx.InternalKeyword().length > 0) {
            visibility = 'internal'
        } else if (ctx.ExternalKeyword().length > 0) {
            visibility = 'external'
        }

        let stateMutability = null
        if (ctx.stateMutability().length > 0) {
            stateMutability = ASTBuilder._toText(ctx.stateMutability(0))
        }

        const node: AST.FunctionTypeName = {
            type: 'FunctionTypeName',
            parameterTypes,
            returnTypes,
            visibility,
            stateMutability,
        }
        let vulnerabilities = []
        parameterTypes.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        returnTypes.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitFunctionTypeParameter(
        ctx: SP.FunctionTypeParameterContext
    ): AST.VariableDeclaration & WithMeta {
        let storageLocation = null
        if (ctx.storageLocation()) {
            storageLocation = ASTBuilder._toText(ctx.storageLocation()!)
        }

        const node: AST.VariableDeclaration = {
            type: 'VariableDeclaration',
            typeName: this.visitTypeName(ctx.typeName()),
            name: null,
            identifier: null,
            storageLocation,
            isStateVar: false,
            isIndexed: false,
            expression: null,
        }

        return this._addMeta(node, ctx, [...node.typeName.vulnerabilities])
    }

    public visitThrowStatement(
        ctx: SP.ThrowStatementContext
    ): AST.ThrowStatement & WithMeta {
        const node: AST.ThrowStatement = {
            type: 'ThrowStatement',
            identifiers: []
        }

        return this._addMeta(node, ctx, [])
    }

    public visitReturnStatement(
        ctx: SP.ReturnStatementContext
    ): AST.ReturnStatement & WithMeta {
        let expression = null
        const ctxExpression = ctx.expression()
        let identifiers = []
        let vulnerabilities = []
        if (ctxExpression) {
            expression = this.visitExpression(ctxExpression)
            identifiers.push(...expression.identifiers)
            vulnerabilities.push(...expression.vulnerabilities)
        }

        const node: AST.ReturnStatement = {
            type: 'ReturnStatement',
            expression,
            identifiers
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitEmitStatement(
        ctx: SP.EmitStatementContext
    ): AST.EmitStatement & WithMeta {
        const node: AST.EmitStatement = {
            type: 'EmitStatement',
            eventCall: this.visitFunctionCall(ctx.functionCall()),
            identifiers: []
        }

        return this._addMeta(node, ctx, [...node.eventCall.vulnerabilities])
    }

    public visitCustomErrorDefinition(
        ctx: SP.CustomErrorDefinitionContext
    ): AST.CustomErrorDefinition & WithMeta {
        const node: AST.CustomErrorDefinition = {
            type: 'CustomErrorDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
            parameters: this.visitParameterList(ctx.parameterList()),
        }
        let vulnerabilities = []
        node.parameters.forEach(item => vulnerabilities.push(...item.vulnerabilities))
        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitTypeDefinition(
        ctx: SP.TypeDefinitionContext
    ): AST.TypeDefinition & WithMeta {
        const node: AST.TypeDefinition = {
            type: 'TypeDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
            definition: this.visitElementaryTypeName(ctx.elementaryTypeName())
        }

        return this._addMeta(node, ctx, [])
    }

    public visitRevertStatement(
        ctx: SP.RevertStatementContext
    ): AST.RevertStatement & WithMeta {
        const node: AST.RevertStatement = {
            type: 'RevertStatement',
            revertCall: this.visitFunctionCall(ctx.functionCall()),
            identifiers: []
        }
        return this._addMeta(node, ctx, [...node.revertCall.vulnerabilities])
    }

    public visitFunctionCall(
        ctx: SP.FunctionCallContext
    ): AST.FunctionCall & WithMeta {
        let args: AST.Expression[] = []
        const names = []
        let identifiers = []
        let vulnerabilities = []

        const ctxArgs = ctx.functionCallArguments()
        const ctxArgsExpressionList = ctxArgs.expressionList()
        const ctxArgsNameValueList = ctxArgs.nameValueList()
        if (ctxArgsExpressionList) {
            args = ctxArgsExpressionList
                .expression()
                .map((exprCtx) => {
                    let temp = this.visitExpression(exprCtx)
                    identifiers.push(...temp.identifiers)
                    vulnerabilities.push(...temp.vulnerabilities)
                    return temp
                })

        } else if (ctxArgsNameValueList) {
            for (const nameValue of ctxArgsNameValueList.nameValue()) {
                let temp = this.visitExpression(nameValue.expression())
                args.push(temp)
                names.push(ASTBuilder._toText(nameValue.identifier()))
                identifiers.push(...temp.identifiers)
                vulnerabilities.push(...temp.vulnerabilities)
            }
        }
        let expression = this.visitExpression(ctx.expression())
        vulnerabilities.push(...expression.vulnerabilities)
        if (expression.type === "Identifier" && expression.subIdentifier.type === "MemberAccess") {
            identifiers = [...expression.subIdentifier.identifiers, ...identifiers]
        }

        const node: AST.FunctionCall = {
            type: 'FunctionCall',
            expression,
            arguments: args,
            names,
            identifiers,
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitStructDefinition(
        ctx: SP.StructDefinitionContext
    ): AST.StructDefinition & WithMeta {
        const node: AST.StructDefinition = {
            type: 'StructDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
            members: ctx
                .variableDeclaration()
                .map((x) => this.visitVariableDeclaration(x)),
        }
        let vulnerabilities = []
        node.members.forEach(item => vulnerabilities.push(...item.vulnerabilities))

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitWhileStatement(
        ctx: SP.WhileStatementContext
    ): AST.WhileStatement & WithMeta {
        let condition = this.visitExpression(ctx.expression())
        let body = this.visitStatement(ctx.statement())

        const node: AST.WhileStatement = {
            type: 'WhileStatement',
            condition,
            body,
            identifiers: [...condition.identifiers, ...body.identifiers]
        }

        return this._addMeta(node, ctx, [...condition.vulnerabilities, ...body.vulnerabilities])
    }

    public visitDoWhileStatement(
        ctx: SP.DoWhileStatementContext
    ): AST.DoWhileStatement & WithMeta {
        let condition = this.visitExpression(ctx.expression())
        let body = this.visitStatement(ctx.statement())
        const node: AST.DoWhileStatement = {
            type: 'DoWhileStatement',
            condition,
            body,
            identifiers: [...condition.identifiers, ...body.identifiers]
        }

        return this._addMeta(node, ctx, [...condition.vulnerabilities, ...body.vulnerabilities])
    }

    public visitIfStatement(
        ctx: SP.IfStatementContext
    ): AST.IfStatement & WithMeta {

        const trueBody = this.visitStatement(ctx.statement(0))
        let condition = this.visitExpression(ctx.expression())
        let identifiers = [...condition.identifiers, ...trueBody.identifiers]
        let falseBody = null
        if (ctx.statement().length > 1) {
            falseBody = this.visitStatement(ctx.statement(1))
            identifiers.push(...falseBody.identifiers)
        }


        const node: AST.IfStatement = {
            type: 'IfStatement',
            condition,
            trueBody,
            falseBody,
            identifiers
        }
        let vulnerabilities = [...condition.vulnerabilities, ...trueBody.vulnerabilities]
        if (falseBody !== null) {
            vulnerabilities.push(...falseBody.vulnerabilities)
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitTryStatement(
        ctx: SP.TryStatementContext
    ): AST.TryStatement & WithMeta {
        let identifiers = []
        let vulnerabilities = []
        let returnParameters = null
        const ctxReturnParameters = ctx.returnParameters()
        if (ctxReturnParameters !== undefined) {
            returnParameters = this.visitReturnParameters(ctxReturnParameters)
            returnParameters.forEach(el => {
                identifiers.push(el.identifier)
                vulnerabilities.push(...el.vulnerabilities)

            })
        }

        const catchClauses = ctx
            .catchClause()
            .map((exprCtx) => {
                let catchClause = this.visitCatchClause(exprCtx)
                identifiers.push(...catchClause.identifiers)
                vulnerabilities.push(...catchClause.vulnerabilities)
                return catchClause
            })
        let expression = this.visitExpression(ctx.expression())
        vulnerabilities.push(...expression.vulnerabilities)
        let body = this.visitBlock(ctx.block())
        vulnerabilities.push(...body.vulnerabilities)
        const node: AST.TryStatement = {
            type: 'TryStatement',
            expression,
            returnParameters,
            body,
            catchClauses,
            identifiers
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitCatchClause(
        ctx: SP.CatchClauseContext
    ): AST.CatchClause & WithMeta {
        let parameters = null
        let identifiers = []
        let vulnerabilities = []
        if (ctx.parameterList()) {
            parameters = this.visitParameterList(ctx.parameterList()!)
            parameters.forEach(el => {
                identifiers.push(el.identifier)
                vulnerabilities.push(...el.vulnerabilities)
            })
        }

        if (
            ctx.identifier() &&
            ASTBuilder._toText(ctx.identifier()!) !== 'Error' &&
            ASTBuilder._toText(ctx.identifier()!) !== 'Panic'
        ) {
            throw new Error('Expected "Error" or "Panic" identifier in catch clause')
        }

        let kind = null
        const ctxIdentifier = ctx.identifier()
        if (ctxIdentifier !== undefined) {
            kind = ASTBuilder._toText(ctxIdentifier)
        }
        let body = this.visitBlock(ctx.block())
        vulnerabilities.push(...body.vulnerabilities)
        const node: AST.CatchClause = {
            type: 'CatchClause',
            // deprecated, use the `kind` property instead,
            isReasonStringType: kind === 'Error',
            kind,
            parameters,
            body,
            identifiers: [...identifiers, ...body.identifiers]
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitExpressionStatement(
        ctx: SP.ExpressionStatementContext
    ): AST.ExpressionStatement & WithMeta {
        if (!ctx) {
            return null as any
        }
        let expression = this.visitExpression(ctx.expression())
        const node: AST.ExpressionStatement = {
            type: 'ExpressionStatement',
            expression,
            identifiers: expression.type === "Identifier" ? [expression] : expression.identifiers
        }
        return this._addMeta(node, ctx, [...expression.vulnerabilities])
    }

    public visitNumberLiteral(
        ctx: SP.NumberLiteralContext
    ): AST.NumberLiteral & WithMeta {
        const number = ASTBuilder._toText(ctx.getChild(0))
        let subdenomination = null

        if (ctx.children?.length === 2) {
            subdenomination = ASTBuilder._toText(ctx.getChild(1))
        }

        const node: AST.NumberLiteral = {
            type: 'NumberLiteral',
            number,
            subdenomination: subdenomination as AST.NumberLiteral['subdenomination'],
            identifiers: []
        }

        return this._addMeta(node, ctx, [])
    }

    public visitMappingKey(
        ctx: SP.MappingKeyContext
    ): (AST.ElementaryTypeName | AST.UserDefinedTypeName) & WithMeta {
        if (ctx.elementaryTypeName()) {
            return this.visitElementaryTypeName(ctx.elementaryTypeName()!)
        } else if (ctx.userDefinedTypeName()) {
            return this.visitUserDefinedTypeName(ctx.userDefinedTypeName()!)
        } else {
            throw new Error(
                'Expected MappingKey to have either ' +
                'elementaryTypeName or userDefinedTypeName'
            )
        }
    }

    public visitMapping(ctx: SP.MappingContext): AST.Mapping & WithMeta {
        const node: AST.Mapping = {
            type: 'Mapping',
            keyType: this.visitMappingKey(ctx.mappingKey()),
            valueType: this.visitTypeName(ctx.typeName()),
        }

        return this._addMeta(node, ctx, [...node.valueType.vulnerabilities])
    }

    public visitModifierDefinition(
        ctx: SP.ModifierDefinitionContext
    ): AST.ModifierDefinition & WithMeta {
        let parameters = null
        let identifiers = []
        let vulnerabilities = []

        if (ctx.parameterList()) {
            parameters = this.visitParameterList(ctx.parameterList()!)
            parameters.forEach(el => {
                identifiers.push(el.identifier)
                vulnerabilities.push(...el.vulnerabilities)
            })
        }

        let isVirtual = false
        if (ctx.VirtualKeyword().length > 0) {
            isVirtual = true
        }

        let override
        const overrideSpecifier = ctx.overrideSpecifier()
        if (overrideSpecifier.length === 0) {
            override = null
        } else {
            override = overrideSpecifier[0]
                .userDefinedTypeName()
                .map((x) => this.visitUserDefinedTypeName(x))
        }

        let body = null
        const blockCtx = ctx.block()
        if (blockCtx !== undefined) {
            body = this.visitBlock(blockCtx)
            identifiers.push(...body.identifiers)
            vulnerabilities.push(...body.vulnerabilities)
        }

        const node: AST.ModifierDefinition = {
            type: 'ModifierDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
            parameters,
            body,
            isVirtual,
            override,
            identifiers
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitUncheckedStatement(
        ctx: SP.UncheckedStatementContext
    ): AST.UncheckedStatement & WithMeta {
        let block = this.visitBlock(ctx.block())
        const node: AST.UncheckedStatement = {
            type: 'UncheckedStatement',
            block,
            identifiers: block.identifiers
        }

        return this._addMeta(node, ctx, [...block.vulnerabilities])
    }

    public visitExpression(ctx: SP.ExpressionContext): AST.Expression & WithMeta {
        let op: string

        switch (ctx.children!.length) {
            case 1: {
                // primary expression
                const primaryExpressionCtx = ctx.tryGetRuleContext(
                    0,
                    SP.PrimaryExpressionContext
                )
                if (primaryExpressionCtx === undefined) {
                    throw new Error(
                        'Assertion error: primary expression should exist when children length is 1'
                    )
                }
                return this.visitPrimaryExpression(primaryExpressionCtx)
            }
            case 2:
                op = ASTBuilder._toText(ctx.getChild(0))

                // new expression
                if (op === 'new') {
                    const node: AST.NewExpression = {
                        type: 'NewExpression',
                        typeName: this.visitTypeName(ctx.typeName()!),
                        identifiers: []
                    }
                    return this._addMeta(node, ctx, [...node.typeName.vulnerabilities])
                }

                const subExpression = this.visitExpression(ctx.getRuleContext(0, SP.ExpressionContext))
                // prefix operators
                if (AST.unaryOpValues.includes(op as AST.UnaryOp)) {
                    let identifiers = []

                    if (subExpression.type !== "Identifier") {
                        subExpression.identifiers.forEach(id => {
                            if (['++', '--', 'delete',].includes(op as AST.UnaryOp)) {
                                identifiers.push({
                                    ...id,
                                    isReadOperation: false,
                                    isWriteOperation: true
                                })
                            }
                        })
                    } else {
                        if (['++', '--', 'delete',].includes(op as AST.UnaryOp)) {
                            identifiers.push({
                                ...subExpression,
                                isReadOperation: false,
                                isWriteOperation: true
                            })
                        }
                    }
                    const node: AST.UnaryOperation = {
                        type: 'UnaryOperation',
                        operator: op as AST.UnaryOp,
                        subExpression: subExpression,
                        isPrefix: true,
                        identifiers

                    }
                    return this._addMeta(node, ctx, [...subExpression.vulnerabilities])
                }

                op = ASTBuilder._toText(ctx.getChild(1))!

                // postfix operators
                if (['++', '--'].includes(op)) {
                    let identifiers = []
                    // todo

                    if (subExpression.type !== "Identifier") {
                        subExpression.identifiers.forEach(id => {
                            if (['++', '--', 'delete',].includes(op as AST.UnaryOp)) {
                                identifiers.push({
                                    ...id,
                                    isReadOperation: false,
                                    isWriteOperation: true
                                })
                            }
                        })
                    } else {
                        if (['++', '--', 'delete',].includes(op as AST.UnaryOp)) {
                            identifiers.push({
                                ...subExpression,
                                isReadOperation: false,
                                isWriteOperation: true
                            })
                        }
                    }
                    const node: AST.UnaryOperation = {
                        type: 'UnaryOperation',
                        operator: op as AST.UnaryOp,
                        subExpression: subExpression,
                        isPrefix: false,
                        identifiers: subExpression.identifiers
                    }
                    return this._addMeta(node, ctx, [...subExpression.vulnerabilities])
                }
                break

            case 3:
                // treat parenthesis as no-op
                if (
                    ASTBuilder._toText(ctx.getChild(0)) === '(' &&
                    ASTBuilder._toText(ctx.getChild(2)) === ')'
                ) {
                    const components = [this.visitExpression(ctx.getRuleContext(0, SP.ExpressionContext)),]
                    const node: AST.TupleExpression = {
                        type: 'TupleExpression',
                        components,
                        isArray: false,
                        identifiers: components[0].identifiers
                    }
                    return this._addMeta(node, ctx, [...components[0].vulnerabilities])
                }

                op = ASTBuilder._toText(ctx.getChild(1))!

                // member access
                if (op === '.') {
                    const expression = this.visitExpression(ctx.expression(0))
                    const node: AST.Identifier = {
                        subIdentifier: {
                            type: 'MemberAccess',
                            expression,
                            memberName: ASTBuilder._toText(ctx.identifier()!),
                            identifiers: expression.identifiers
                        },
                        type: 'Identifier',
                        name: "",
                        identifiers: [
                            {
                                subIdentifier: {
                                    type: 'MemberAccess',
                                    expression,
                                    memberName: ASTBuilder._toText(ctx.identifier()!),
                                    identifiers: expression.identifiers
                                },
                                type: 'Identifier',
                                name: "",
                                identifiers: expression.identifiers
                            }]
                        // ...expression.identifiers]
                    }
                    return this._addMeta(node, ctx, [...expression.vulnerabilities])
                }

                if (isBinOp(op)) {
                    let left = this.visitExpression(ctx.expression(0))
                    let right = this.visitExpression(ctx.expression(1))
                    let identifiers = []
                    if (isAssignmentOp(op)) {
                        if (left.type === "Identifier") {
                            identifiers.push({...left, isReadOperation: false, isWriteOperation: true})
                        } else {
                            left.identifiers.forEach(id => {
                                identifiers.push(id)
                            })
                            if (identifiers.length > 0) {
                                identifiers[0].isReadOperation = false
                                identifiers[0].isWriteOperation = true
                            }

                        }
                        if (right.type === "Identifier") {
                            identifiers.push({
                                ...right,
                                isReadOperation: true,
                                isWriteOperation: right.isWriteOperation === undefined ? false : right.isWriteOperation
                            })
                        } else {
                            right.identifiers.forEach(el => {
                                el.isReadOperation = true
                                if (el.isWriteOperation === undefined) {
                                    el.isWriteOperation = false
                                }
                            })
                            identifiers.push(...right.identifiers)
                        }

                    } else {
                        identifiers = [...left.identifiers, ...right.identifiers]
                    }
                    let vulnerabilities = [];
                    if (left.type === "UnaryOperation" && left.operator === "!" && right.type === "UnaryOperation" && right.operator === "!" && (op === "&&" || op === "||")) {
                        vulnerabilities.push({
                            type: "de-morgan",
                            range: this._range(ctx),
                            loc: ASTBuilder._loc(ctx)
                        })
                    }
                    vulnerabilities.push(...left.vulnerabilities)
                    vulnerabilities.push(...right.vulnerabilities)
                    const node: AST.BinaryOperation = {
                        type: 'BinaryOperation',
                        operator: op,
                        left,
                        right,
                        identifiers
                    }
                    return this._addMeta(node, ctx, vulnerabilities)
                }
                break

            case 4:
                // function call
                if (
                    ASTBuilder._toText(ctx.getChild(1)) === '(' &&
                    ASTBuilder._toText(ctx.getChild(3)) === ')'
                ) {
                    let args: AST.Expression[] = []
                    const names = []
                    let identifiers = []
                    let vulnerabilities = []

                    const ctxArgs = ctx.functionCallArguments()!
                    if (ctxArgs.expressionList()) {
                        args = ctxArgs
                            .expressionList()!
                            .expression()
                            .map((exprCtx) => {
                                let temp = this.visitExpression(exprCtx)
                                identifiers.push(...temp.identifiers)
                                vulnerabilities.push(...temp.vulnerabilities)
                                return temp
                            })
                    } else if (ctxArgs.nameValueList()) {
                        for (const nameValue of ctxArgs.nameValueList()!.nameValue()) {
                            let temp = this.visitExpression(nameValue.expression())
                            args.push(temp)
                            names.push(ASTBuilder._toText(nameValue.identifier()))
                            identifiers.push(...temp.identifiers)
                            vulnerabilities.push(...temp.vulnerabilities)
                        }
                    }

                    let expression = this.visitExpression(ctx.expression(0))
                    if (expression.type === "Identifier" && expression.subIdentifier.type === "MemberAccess") {
                        identifiers = [...expression.subIdentifier.identifiers, ...identifiers]
                    }
                    vulnerabilities.push(...expression.vulnerabilities)
                    const node: AST.FunctionCall = {
                        type: 'FunctionCall',
                        expression,
                        arguments: args,
                        names,
                        identifiers,
                    }

                    return this._addMeta(node, ctx, vulnerabilities)
                }

                // index access
                if (
                    ASTBuilder._toText(ctx.getChild(1)) === '[' &&
                    ASTBuilder._toText(ctx.getChild(3)) === ']'
                ) {
                    const base = this.visitExpression(ctx.expression(0))
                    if (ctx.getChild(2).text === ':') {

                        const node: AST.Identifier = {
                            subIdentifier: {
                                type: 'IndexRangeAccess',
                                base,
                                identifiers: base.identifiers
                            },
                            type: 'Identifier',
                            name: "",
                            identifiers: [{
                                subIdentifier: {
                                    type: 'IndexRangeAccess',
                                    base,
                                    identifiers: base.identifiers
                                },
                                type: 'Identifier',
                                name: "",
                                identifiers: base.identifiers
                            }]
                            // , ...base.identifiers]
                        }

                        return this._addMeta(node, ctx, [...base.vulnerabilities])
                    }

                    const index = this.visitExpression(ctx.expression(1))
                    const node: AST.Identifier = {
                        subIdentifier: {
                            type: 'IndexAccess',
                            base,
                            index,
                            identifiers: [...base.identifiers, ...index.identifiers]
                        },
                        type: 'Identifier',
                        name: "",
                        identifiers: [
                            {
                                subIdentifier: {
                                    type: 'IndexAccess',
                                    base,
                                    index,
                                    identifiers: [...base.identifiers, ...index.identifiers]
                                },
                                type: 'Identifier',
                                name: "",
                                identifiers: [...base.identifiers, ...index.identifiers]
                            }]
                        // ...base.identifiers, ...index.identifiers]
                    }
                    return this._addMeta(node, ctx, [...base.vulnerabilities, ...index.vulnerabilities])
                }

                // expression with nameValueList
                if (
                    ASTBuilder._toText(ctx.getChild(1)) === '{' &&
                    ASTBuilder._toText(ctx.getChild(3)) === '}'
                ) {
                    const expression = this.visitExpression(ctx.expression(0))
                    const arguments_ = this.visitNameValueList(ctx.nameValueList()!)
                    const node: AST.NameValueExpression = {
                        type: 'NameValueExpression',
                        expression,
                        arguments: arguments_,
                        identifiers: [...expression.identifiers, ...arguments_.identifiers]
                    }

                    return this._addMeta(node, ctx, [...expression.vulnerabilities, ...arguments_.vulnerabilities])
                }

                break

            case 5:
                // ternary operator
                if (
                    ASTBuilder._toText(ctx.getChild(1)) === '?' &&
                    ASTBuilder._toText(ctx.getChild(3)) === ':'
                ) {
                    let condition = this.visitExpression(ctx.expression(0))
                    let trueExpression = this.visitExpression(ctx.expression(1))
                    let falseExpression = this.visitExpression(ctx.expression(2))
                    const node: AST.Conditional = {
                        type: 'Conditional',
                        condition,
                        trueExpression,
                        falseExpression,
                        identifiers: [...condition.identifiers, ...trueExpression.identifiers, ...falseExpression.identifiers]
                    }

                    return this._addMeta(node, ctx, [...condition.vulnerabilities, ...trueExpression.vulnerabilities, ...falseExpression.vulnerabilities])
                }

                const base = this.visitExpression(ctx.expression(0))
                const index = this.visitExpression(ctx.expression(1))
                // index range access
                if (
                    ASTBuilder._toText(ctx.getChild(1)) === '[' &&
                    ASTBuilder._toText(ctx.getChild(2)) === ':' &&
                    ASTBuilder._toText(ctx.getChild(4)) === ']'
                ) {
                    const node: AST.Identifier = {
                        subIdentifier: {
                            type: 'IndexRangeAccess',
                            base,
                            indexEnd: index,
                            identifiers: [...base.identifiers, ...index.identifiers]
                        },
                        type: 'Identifier',
                        name: "",
                        identifiers: [{
                            subIdentifier: {
                                type: 'IndexRangeAccess',
                                base,
                                indexEnd: index,
                                identifiers: [...base.identifiers, ...index.identifiers]
                            },
                            type: 'Identifier',
                            name: "",
                            identifiers: [...base.identifiers, ...index.identifiers]
                        }]
                        // , ...base.identifiers, ...index.identifiers]
                    }


                    return this._addMeta(node, ctx, [...base.vulnerabilities, ...index.vulnerabilities])
                } else if (
                    ASTBuilder._toText(ctx.getChild(1)) === '[' &&
                    ASTBuilder._toText(ctx.getChild(3)) === ':' &&
                    ASTBuilder._toText(ctx.getChild(4)) === ']'
                ) {

                    const node: AST.Identifier = {
                        subIdentifier: {
                            type: 'IndexRangeAccess',
                            base,
                            indexStart: index,
                            identifiers: [...base.identifiers, ...index.identifiers]
                        },
                        type: 'Identifier',
                        name: "",
                        identifiers: [{
                            subIdentifier: {
                                type: 'IndexRangeAccess',
                                base,
                                indexStart: index,
                                identifiers: [...base.identifiers, ...index.identifiers]
                            },
                            type: 'Identifier',
                            name: "",
                            identifiers: [...base.identifiers, ...index.identifiers]
                        }, ...base.identifiers, ...index.identifiers]
                    }


                    return this._addMeta(node, ctx, [...base.vulnerabilities, ...index.vulnerabilities])
                }
                break

            case 6:
                // index range access
                if (
                    ASTBuilder._toText(ctx.getChild(1)) === '[' &&
                    ASTBuilder._toText(ctx.getChild(3)) === ':' &&
                    ASTBuilder._toText(ctx.getChild(5)) === ']'
                ) {
                    const base = this.visitExpression(ctx.expression(0))
                    const indexStart = this.visitExpression(ctx.expression(1))
                    const indexEnd = this.visitExpression(ctx.expression(2))
                    const node: AST.Identifier = {
                        subIdentifier: {
                            type: 'IndexRangeAccess',
                            base,
                            indexStart,
                            indexEnd,
                            identifiers: [...base.identifiers, ...indexStart.identifiers, ...indexEnd.identifiers]
                        },
                        type: 'Identifier',
                        name: "",
                        identifiers: [{
                            subIdentifier: {
                                type: 'IndexRangeAccess',
                                base,
                                indexStart,
                                indexEnd,
                                identifiers: [...base.identifiers, ...indexStart.identifiers, ...indexEnd.identifiers]
                            },
                            type: 'Identifier',
                            name: "",
                            identifiers: [...base.identifiers, ...indexStart.identifiers, ...indexEnd.identifiers]
                        }, ...base.identifiers, ...indexStart.identifiers, ...indexEnd.identifiers]
                    }


                    return this._addMeta(node, ctx, [...base.vulnerabilities, ...indexStart.vulnerabilities, ...indexEnd.vulnerabilities])
                }
                break
        }

        throw new Error('Unrecognized expression')
    }

    public visitNameValueList(
        ctx: SP.NameValueListContext
    ): AST.NameValueList & WithMeta {
        const names: string[] = []
        const identifiers: AST.Identifier[] = []
        const args: AST.Expression[] = []
        let vulnerabilities = []

        for (const nameValue of ctx.nameValue()) {
            names.push(ASTBuilder._toText(nameValue.identifier()))
            identifiers.push(this.visitIdentifier(nameValue.identifier()))
            let expression = this.visitExpression(nameValue.expression())
            args.push(expression)
            vulnerabilities.push(...expression.vulnerabilities)

        }

        const node: AST.NameValueList = {
            type: 'NameValueList',
            names,
            identifiers,
            arguments: args,
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitFileLevelConstant(ctx: SP.FileLevelConstantContext) {
        const type = this.visitTypeName(ctx.typeName())
        const iden = ctx.identifier()
        const name = ASTBuilder._toText(iden)

        const expression = this.visitExpression(ctx.expression())

        const node: AST.FileLevelConstant = {
            type: 'FileLevelConstant',
            typeName: type,
            name,
            initialValue: expression,
            isDeclaredConst: true,
            isImmutable: false,
        }

        return this._addMeta(node, ctx, [...type.vulnerabilities, ...expression.vulnerabilities])
    }

    public visitForStatement(ctx: SP.ForStatementContext) {
        let conditionExpression: any = this.visitExpressionStatement(
            ctx.expressionStatement()!
        )
        let vulnerabilities = []

        let initExpression = ctx.simpleStatement()
            ? this.visitSimpleStatement(ctx.simpleStatement()!)
            : null;
        if (initExpression !== null) vulnerabilities.push(...initExpression.vulnerabilities)

        let identifiers = initExpression !== null ? [...initExpression.identifiers] : []
        if (conditionExpression) {
            conditionExpression = conditionExpression.expression
            identifiers.push(...conditionExpression.identifiers)
            vulnerabilities.push(...conditionExpression.vulnerabilities)
        }
        let loopExpression = ctx.expression() !== undefined ? this.visitExpression(ctx.expression()!) : null
        if (loopExpression !== null) {
            identifiers.push(...loopExpression.identifiers)
            vulnerabilities.push(...loopExpression.vulnerabilities)
        }
        let body = this.visitStatement(ctx.statement());
        if (body.type === "Block") {

            for (let i = 0; i < body.statements.length; i++) {
                let statement = body.statements[i]
                if (statement.type === "VariableDeclarationStatement") {
                    let vulnerability = repeatedCalculate(body, statement, loopExpression, i)
                    if (vulnerability !== null) vulnerabilities.push(vulnerability)
                }
            }
        }
        vulnerabilities.push(...body.vulnerabilities)


        const node: AST.ForStatement = {
            type: 'ForStatement',
            initExpression,
            conditionExpression,
            loopExpression: {
                type: 'ExpressionStatement',
                expression: loopExpression,
                identifiers: loopExpression.identifiers,
                range:loopExpression.range
            },
            body,
            identifiers: [...identifiers, ...body.identifiers]
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public visitHexLiteral(ctx: SP.HexLiteralContext) {
        const parts = ctx
            .HexLiteralFragment()
            .map((x) => ASTBuilder._toText(x))
            .map((x) => x.substring(4, x.length - 1))

        const node: AST.HexLiteral = {
            type: 'HexLiteral',
            value: parts.join(''),
            parts,
            identifiers: []
        }

        return this._addMeta(node, ctx, [])
    }

    public visitPrimaryExpression(
        ctx: SP.PrimaryExpressionContext
    ): AST.PrimaryExpression & WithMeta {
        if (ctx.BooleanLiteral()) {
            const node: AST.BooleanLiteral = {
                type: 'BooleanLiteral',
                value: ASTBuilder._toText(ctx.BooleanLiteral()!) === 'true',
                identifiers: []
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.hexLiteral()) {
            return this.visitHexLiteral(ctx.hexLiteral()!)
        }

        if (ctx.stringLiteral()) {
            const fragments = ctx
                .stringLiteral()!
                .StringLiteralFragment()
                .map((stringLiteralFragmentCtx: any) => {
                    let text = ASTBuilder._toText(stringLiteralFragmentCtx)!

                    const isUnicode = text.slice(0, 7) === 'unicode'
                    if (isUnicode) {
                        text = text.slice(7)
                    }
                    const singleQuotes = text[0] === "'"
                    const textWithoutQuotes = text.substring(1, text.length - 1)
                    const value = singleQuotes
                        ? textWithoutQuotes.replace(new RegExp("\\\\'", 'g'), "'")
                        : textWithoutQuotes.replace(new RegExp('\\\\"', 'g'), '"')

                    return {value, isUnicode}
                })

            const parts = fragments.map((x: any) => x.value)

            const node: AST.StringLiteral = {
                type: 'StringLiteral',
                value: parts.join(''),
                parts,
                isUnicode: fragments.map((x: any) => x.isUnicode),
                identifiers: []
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.numberLiteral()) {
            return this.visitNumberLiteral(ctx.numberLiteral()!)
        }

        if (ctx.TypeKeyword()) {
            const node: AST.Identifier = {
                type: 'Identifier',
                name: 'type',
                identifiers: [],
                subIdentifier: {
                    type: "Common",
                    identifiers: []
                }
            }

            return this._addMeta(node, ctx, [])
        }

        if (
            ctx.children!.length == 3 &&
            ASTBuilder._toText(ctx.getChild(1)) === '[' &&
            ASTBuilder._toText(ctx.getChild(2)) === ']'
        ) {
            let node: any = this.visit(ctx.getChild(0))
            let identifiers = []
            if (node.type === 'Identifier') {
                node = {
                    type: 'UserDefinedTypeName',
                    namePath: node.name,
                }
                identifiers.push(node)
            } else if (node.type == 'TypeNameExpression') {
                node = node.typeName
            } else {
                node = {
                    type: 'ElementaryTypeName',
                    name: ASTBuilder._toText(ctx.getChild(0)),
                }
            }

            const typeName: AST.ArrayTypeName = {
                type: 'ArrayTypeName',
                baseTypeName: this._addMeta(node, ctx, []),
                length: null,
            }

            const result: AST.TypeNameExpression = {
                type: 'TypeNameExpression',
                typeName: this._addMeta(typeName, ctx, []),
                identifiers
            }

            return this._addMeta(result, ctx, [])
        }

        return this.visit(ctx.getChild(0)) as any
    }

    public visitTupleExpression(
        ctx: SP.TupleExpressionContext
    ): AST.TupleExpression & WithMeta {
        // remove parentheses
        const children = ctx.children!.slice(1, -1)
        const components = ASTBuilder._mapCommasToNulls(children).map((expr) => {
            // add a null for each empty value
            if (expr === null) {
                return null
            }
            return this.visit(expr)
        })

        let identifiers = []
        let vulnerabilities = []
        components.forEach(el => {
            if (el.type === "Identifier") {
                identifiers.push(el)
                vulnerabilities.push(...el.vulnerabilities)
            }
        })

        const node: AST.TupleExpression = {
            type: 'TupleExpression',
            components,
            isArray: ASTBuilder._toText(ctx.getChild(0)) === '[',
            identifiers
        }

        return this._addMeta(node, ctx, vulnerabilities)
    }

    public buildIdentifierList(ctx: SP.IdentifierListContext) {
        // remove parentheses
        const children = ctx.children!.slice(1, -1)
        const identifiers = ctx.identifier()
        let i = 0
        return ASTBuilder._mapCommasToNulls(children).map((idenOrNull) => {
            // add a null for each empty value
            if (!idenOrNull) {
                return null
            }

            const iden = identifiers[i]
            i++

            const node: AST.VariableDeclaration = {
                type: 'VariableDeclaration',
                name: ASTBuilder._toText(iden),
                identifier: this.visitIdentifier(iden),
                isStateVar: false,
                isIndexed: false,
                typeName: null,
                storageLocation: null,
                expression: null,
            }

            return this._addMeta(node, iden, [])
        })
    }

    public buildVariableDeclarationList(
        ctx: SP.VariableDeclarationListContext
    ): Array<(AST.VariableDeclaration & WithMeta) | null> {
        // remove parentheses

        const variableDeclarations = ctx.variableDeclaration()
        let i = 0
        return ASTBuilder._mapCommasToNulls(ctx.children!).map((declOrNull) => {
            // add a null for each empty value
            if (!declOrNull) {
                return null
            }

            const decl = variableDeclarations[i]
            i++

            let storageLocation: string | null = null
            if (decl.storageLocation()) {
                storageLocation = ASTBuilder._toText(decl.storageLocation()!)
            }

            const identifierCtx = decl.identifier()

            const result: AST.VariableDeclaration = {
                type: 'VariableDeclaration',
                name: ASTBuilder._toText(identifierCtx),
                identifier: this.visitIdentifier(identifierCtx),
                typeName: this.visitTypeName(decl.typeName()),
                storageLocation,
                isStateVar: false,
                isIndexed: false,
                expression: null,
            }

            return this._addMeta(result, decl, [...result.typeName.vulnerabilities])
        })
    }

    public visitImportDirective(ctx: SP.ImportDirectiveContext) {
        const pathString = ASTBuilder._toText(ctx.importPath())
        let unitAlias = null
        let unitAliasIdentifier = null
        let symbolAliases = null
        let symbolAliasesIdentifiers = null

        if (ctx.importDeclaration().length > 0) {
            symbolAliases = ctx.importDeclaration().map((decl) => {
                const symbol = ASTBuilder._toText(decl.identifier(0))
                let alias = null
                if (decl.identifier().length > 1) {
                    alias = ASTBuilder._toText(decl.identifier(1))
                }
                return [symbol, alias] as [string, string | null]
            })
            symbolAliasesIdentifiers = ctx.importDeclaration().map((decl) => {
                const symbolIdentifier = this.visitIdentifier(decl.identifier(0))
                let aliasIdentifier = null
                if (decl.identifier().length > 1) {
                    aliasIdentifier = this.visitIdentifier(decl.identifier(1))
                }
                return [symbolIdentifier, aliasIdentifier] as [
                    AST.Identifier,
                        AST.Identifier | null
                ]
            })
        } else {
            const identifierCtxList = ctx.identifier()
            if (identifierCtxList.length === 0) {
                // nothing to do
            } else if (identifierCtxList.length === 1) {
                const aliasIdentifierCtx = ctx.identifier(0)
                unitAlias = ASTBuilder._toText(aliasIdentifierCtx)
                unitAliasIdentifier = this.visitIdentifier(aliasIdentifierCtx)
            } else if (identifierCtxList.length === 2) {
                const aliasIdentifierCtx = ctx.identifier(1)
                unitAlias = ASTBuilder._toText(aliasIdentifierCtx)
                unitAliasIdentifier = this.visitIdentifier(aliasIdentifierCtx)
            } else {
                throw new Error(
                    'Assertion error: an import should have one or two identifiers'
                )
            }
        }

        const path = pathString.substring(1, pathString.length - 1)

        const pathLiteral: AST.StringLiteral = {
            type: 'StringLiteral',
            value: path,
            parts: [path],
            isUnicode: [false], // paths in imports don't seem to support unicode literals
            identifiers: []
        }

        const node: AST.ImportDirective = {
            type: 'ImportDirective',
            path,
            pathLiteral: this._addMeta(pathLiteral, ctx.importPath(), []),
            unitAlias,
            unitAliasIdentifier,
            symbolAliases,
            symbolAliasesIdentifiers,
        }

        return this._addMeta(node, ctx, [])
    }

    public buildEventParameterList(ctx: SP.EventParameterListContext) {
        return ctx.eventParameter().map((paramCtx: any) => {
            const type = this.visit(paramCtx.typeName())
            let name = null
            if (paramCtx.identifier()) {
                name = ASTBuilder._toText(paramCtx.identifier())
            }

            return {
                type: 'VariableDeclaration',
                typeName: type,
                name,
                isStateVar: false,
                isIndexed: !!paramCtx.IndexedKeyword(0),
            }
        })
    }

    public visitReturnParameters(
        ctx: SP.ReturnParametersContext
    ): (AST.VariableDeclaration & WithMeta)[] {
        return this.visitParameterList(ctx.parameterList())
    }

    public visitParameterList(
        ctx: SP.ParameterListContext
    ): (AST.VariableDeclaration & WithMeta)[] {
        return ctx.parameter().map((paramCtx: any) => this.visitParameter(paramCtx))
    }

    public visitInlineAssemblyStatement(ctx: SP.InlineAssemblyStatementContext) {
        let language: string | null = null
        if (ctx.StringLiteralFragment()) {
            language = ASTBuilder._toText(ctx.StringLiteralFragment()!)!
            language = language.substring(1, language.length - 1)
        }

        const node: AST.InlineAssemblyStatement = {
            type: 'InlineAssemblyStatement',
            language,
            body: this.visitAssemblyBlock(ctx.assemblyBlock()),
            identifiers: []
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyBlock(
        ctx: SP.AssemblyBlockContext
    ): AST.AssemblyBlock & WithMeta {
        const operations = ctx
            .assemblyItem()
            .map((item) => this.visitAssemblyItem(item))

        const node: AST.AssemblyBlock = {
            type: 'AssemblyBlock',
            operations,
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyItem(
        ctx: SP.AssemblyItemContext
    ): AST.AssemblyItem & WithMeta {
        let text

        if (ctx.hexLiteral()) {
            return this.visitHexLiteral(ctx.hexLiteral()!)
        }

        if (ctx.stringLiteral()) {
            text = ASTBuilder._toText(ctx.stringLiteral()!)!
            const value = text.substring(1, text.length - 1)
            const node: AST.StringLiteral = {
                type: 'StringLiteral',
                value,
                parts: [value],
                isUnicode: [false], // assembly doesn't seem to support unicode literals right now
                identifiers: []
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.BreakKeyword()) {
            const node: AST.Break = {
                type: 'Break',
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.ContinueKeyword()) {
            const node: AST.Continue = {
                type: 'Continue',
            }

            return this._addMeta(node, ctx, [])
        }

        return this.visit(ctx.getChild(0)) as AST.AssemblyItem & WithMeta
    }

    public visitAssemblyExpression(ctx: SP.AssemblyExpressionContext) {
        return this.visit(ctx.getChild(0)) as AST.AssemblyExpression & WithMeta
    }

    public visitAssemblyCall(ctx: SP.AssemblyCallContext) {
        const functionName = ASTBuilder._toText(ctx.getChild(0))
        const args = ctx
            .assemblyExpression()
            .map((assemblyExpr) => this.visitAssemblyExpression(assemblyExpr))

        const node: AST.AssemblyCall = {
            type: 'AssemblyCall',
            functionName,
            arguments: args,
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyLiteral(
        ctx: SP.AssemblyLiteralContext
    ): AST.AssemblyLiteral & WithMeta {
        let text

        if (ctx.stringLiteral()) {
            text = ASTBuilder._toText(ctx)!
            const value = text.substring(1, text.length - 1)
            const node: AST.StringLiteral = {
                type: 'StringLiteral',
                value,
                parts: [value],
                isUnicode: [false], // assembly doesn't seem to support unicode literals right now
                identifiers: []
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.DecimalNumber()) {
            const node: AST.DecimalNumber = {
                type: 'DecimalNumber',
                value: ASTBuilder._toText(ctx),
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.HexNumber()) {
            const node: AST.HexNumber = {
                type: 'HexNumber',
                value: ASTBuilder._toText(ctx),
            }

            return this._addMeta(node, ctx, [])
        }

        if (ctx.hexLiteral()) {
            return this.visitHexLiteral(ctx.hexLiteral()!)
        }

        throw new Error('Should never reach here')
    }

    public visitAssemblySwitch(ctx: SP.AssemblySwitchContext) {
        const node: AST.AssemblySwitch = {
            type: 'AssemblySwitch',
            expression: this.visitAssemblyExpression(ctx.assemblyExpression()),
            cases: ctx.assemblyCase().map((c) => this.visitAssemblyCase(c)),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyCase(
        ctx: SP.AssemblyCaseContext
    ): AST.AssemblyCase & WithMeta {
        let value = null
        if (ASTBuilder._toText(ctx.getChild(0)) === 'case') {
            value = this.visitAssemblyLiteral(ctx.assemblyLiteral()!)
        }

        const node: AST.AssemblyCase = {
            type: 'AssemblyCase',
            block: this.visitAssemblyBlock(ctx.assemblyBlock()),
            value,
            default: value === null,
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyLocalDefinition(
        ctx: SP.AssemblyLocalDefinitionContext
    ): AST.AssemblyLocalDefinition & WithMeta {
        const ctxAssemblyIdentifierOrList = ctx.assemblyIdentifierOrList()
        let names
        if (ctxAssemblyIdentifierOrList.identifier()) {
            names = [this.visitIdentifier(ctxAssemblyIdentifierOrList.identifier()!)]
        } else if (ctxAssemblyIdentifierOrList.assemblyMember()) {
            names = [
                this.visitAssemblyMember(ctxAssemblyIdentifierOrList.assemblyMember()!),
            ]
        } else {
            names = ctxAssemblyIdentifierOrList
                .assemblyIdentifierList()!
                .identifier()!
                .map((x) => this.visitIdentifier(x))
        }

        let expression: AST.AssemblyExpression | null = null
        if (ctx.assemblyExpression() !== undefined) {
            expression = this.visitAssemblyExpression(ctx.assemblyExpression()!)
        }

        const node: AST.AssemblyLocalDefinition = {
            type: 'AssemblyLocalDefinition',
            names,
            expression,
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyFunctionDefinition(
        ctx: SP.AssemblyFunctionDefinitionContext
    ) {
        const ctxAssemblyIdentifierList = ctx.assemblyIdentifierList()
        const args =
            ctxAssemblyIdentifierList !== undefined
                ? ctxAssemblyIdentifierList
                    .identifier()
                    .map((x) => this.visitIdentifier(x))
                : []

        const ctxAssemblyFunctionReturns = ctx.assemblyFunctionReturns()
        const returnArgs = ctxAssemblyFunctionReturns
            ? ctxAssemblyFunctionReturns
                .assemblyIdentifierList()!
                .identifier()
                .map((x) => this.visitIdentifier(x))
            : []

        const node: AST.AssemblyFunctionDefinition = {
            type: 'AssemblyFunctionDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
            arguments: args,
            returnArguments: returnArgs,
            body: this.visitAssemblyBlock(ctx.assemblyBlock()),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyAssignment(ctx: SP.AssemblyAssignmentContext) {
        const ctxAssemblyIdentifierOrList = ctx.assemblyIdentifierOrList()
        let names
        if (ctxAssemblyIdentifierOrList.identifier()) {
            names = [this.visitIdentifier(ctxAssemblyIdentifierOrList.identifier()!)]
        } else if (ctxAssemblyIdentifierOrList.assemblyMember()) {
            names = [
                this.visitAssemblyMember(ctxAssemblyIdentifierOrList.assemblyMember()!),
            ]
        } else {
            names = ctxAssemblyIdentifierOrList
                .assemblyIdentifierList()!
                .identifier()
                .map((x) => this.visitIdentifier(x))
        }

        const node: AST.AssemblyAssignment = {
            type: 'AssemblyAssignment',
            names,
            expression: this.visitAssemblyExpression(ctx.assemblyExpression()),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyMember(
        ctx: SP.AssemblyMemberContext
    ): AST.AssemblyMemberAccess & WithMeta {
        const [accessed, member] = ctx.identifier()
        const node: AST.AssemblyMemberAccess = {
            type: 'AssemblyMemberAccess',
            expression: this.visitIdentifier(accessed),
            memberName: this.visitIdentifier(member),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitLabelDefinition(ctx: SP.LabelDefinitionContext) {
        const node: AST.LabelDefinition = {
            type: 'LabelDefinition',
            name: ASTBuilder._toText(ctx.identifier()),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyStackAssignment(ctx: SP.AssemblyStackAssignmentContext) {
        const node: AST.AssemblyStackAssignment = {
            type: 'AssemblyStackAssignment',
            name: ASTBuilder._toText(ctx.identifier()),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyFor(ctx: SP.AssemblyForContext) {
        // TODO remove these type assertions
        const node: AST.AssemblyFor = {
            type: 'AssemblyFor',
            pre: this.visit(ctx.getChild(1)) as
                | AST.AssemblyBlock
                | AST.AssemblyExpression,
            condition: this.visit(ctx.getChild(2)) as AST.AssemblyExpression,
            post: this.visit(ctx.getChild(3)) as
                | AST.AssemblyBlock
                | AST.AssemblyExpression,
            body: this.visit(ctx.getChild(4)) as AST.AssemblyBlock,
        }

        return this._addMeta(node, ctx, [])
    }

    public visitAssemblyIf(ctx: SP.AssemblyIfContext) {
        const node: AST.AssemblyIf = {
            type: 'AssemblyIf',
            condition: this.visitAssemblyExpression(ctx.assemblyExpression()),
            body: this.visitAssemblyBlock(ctx.assemblyBlock()),
        }

        return this._addMeta(node, ctx, [])
    }

    public visitContinueStatement(
        ctx: SP.ContinueStatementContext
    ): AST.ContinueStatement & WithMeta {
        const node: AST.ContinueStatement = {
            type: 'ContinueStatement',
            identifiers: []
        }

        return this._addMeta(node, ctx, [])
    }

    public visitBreakStatement(
        ctx: SP.BreakStatementContext
    ): AST.BreakStatement & WithMeta {
        const node: AST.BreakStatement = {
            type: 'BreakStatement',
            identifiers: []
        }

        return this._addMeta(node, ctx, [])
    }

    private static _toText(ctx: ParserRuleContext | ParseTree): string {
        const text = ctx.text
        if (text === undefined) {
            throw new Error('Assertion error: text should never be undefiend')
        }

        return text
    }

    private static _stateMutabilityToText(
        ctx: SP.StateMutabilityContext
    ): AST.FunctionDefinition['stateMutability'] {
        if (ctx.PureKeyword() !== undefined) {
            return 'pure'
        }
        if (ctx.ConstantKeyword() !== undefined) {
            return 'constant'
        }
        if (ctx.PayableKeyword() !== undefined) {
            return 'payable'
        }
        if (ctx.ViewKeyword() !== undefined) {
            return 'view'
        }

        throw new Error('Assertion error: non-exhaustive stateMutability check')
    }

    private static _loc(ctx: ParserRuleContext): SourceLocation {
        return {
            start: {
                line: ctx.start.line,
                column: ctx.start.charPositionInLine,
            },
            end: {
                line: ctx.stop ? ctx.stop.line : ctx.start.line,
                column: ctx.stop
                    ? ctx.stop.charPositionInLine
                    : ctx.start.charPositionInLine,
            },
        }
    }

    _range(ctx: ParserRuleContext): [number, number] {
        return [ctx.start.startIndex, ctx.stop?.stopIndex ?? ctx.start.startIndex]
    }

    private _addMeta<T extends AST.BaseASTNode>(
        node: T,
        ctx: ParserRuleContext,
        vulnerabilities: AST.Vulnerability[]
    ): T & WithMeta {
        const nodeWithMeta: AST.BaseASTNode = {
            type: node.type,
        }

        if (this.options.loc === true) {
            node.loc = ASTBuilder._loc(ctx)
        }
        if (this.options.range === true) {
            node.range = this._range(ctx)
        }
        node.vulnerabilities = vulnerabilities
        return {
            ...nodeWithMeta,
            ...node,
        } as T & WithMeta
    }

    private static _mapCommasToNulls(children: ParseTree[]) {
        if (children.length === 0) {
            return []
        }

        const values: Array<ParseTree | null> = []
        let comma = true

        for (const el of children) {
            if (comma) {
                if (ASTBuilder._toText(el) === ',') {
                    values.push(null)
                } else {
                    values.push(el)
                    comma = false
                }
            } else {
                if (ASTBuilder._toText(el) !== ',') {
                    throw new Error('expected comma')
                }
                comma = true
            }
        }

        if (comma) {
            values.push(null)
        }

        return values
    }
}

function isBinOp(op: string): op is AST.BinOp {
    return AST.binaryOpValues.includes(op as AST.BinOp)
}

function isAssignmentOp(op: string): op is AST.AssignmentOp {
    return AST.assignmentOpValues.includes(op as AST.AssignmentOp)
}

function traceIdentifier(identifier) {
    if (identifier.type === "Identifier") {
        if (identifier.subIdentifier.type === "IndexAccess") {
            return traceIdentifier(identifier.subIdentifier.base)
        } else if (identifier.subIdentifier.type === "MemberAccess") {
            return traceIdentifier(identifier.subIdentifier.expression)
        } else if (identifier.subIdentifier.type === "IndexRangeAccess") {
            return traceIdentifier(identifier.subIdentifier.base)
        } else if (identifier.subIdentifier.type === "Common") {
            return identifier.name
        }
    } else {
        console.log(identifier)
        throw Error("Un-handle")
    }
}

function repeatedCalculate(body: AST.Block, statement: AST.VariableDeclarationStatement, loopExpression: AST.Expression, index): AST.Vulnerability[] {
    let vulnerability = null
    // check whether initialValue contain loop variable or not
    let variableContainLoopVariable = false
    let idenLoopVariable = loopExpression.identifiers.filter(item => item.isWriteOperation === true)
    for (let item of statement.initialValue.identifiers) {
        for (let iden of idenLoopVariable) {
            if (item.name === iden.name) {
                variableContainLoopVariable = true
                break
            }
        }
        if (variableContainLoopVariable === true) break
    }

    // check whether initialValue, variable are modified or not
    let listVariableDeclarationStatement = []
    // get declared Variable list
    for (let variable of statement.variables) {
        listVariableDeclarationStatement.push(variable.name)
    }
    listVariableDeclarationStatement.push(...statement.initialValue.identifiers)

    let variableModifiers = false
    for (let j = index + 1; j < body.statements.length; j++) {
        for (let iden of body.statements[index].identifiers) {
            if (iden.isWriteOperation === true) {
                iden = traceIdentifier(iden)
                for (let variable of listVariableDeclarationStatement) {
                    if (iden === variable) {
                        variableModifiers = true
                        break
                    }
                }
                if (variableModifiers === true) break
            }
        }
        if (variableModifiers === true) break
    }

    if (variableModifiers === false && variableContainLoopVariable === false) {
        vulnerability = {
            type: "repeated-calculate",
            range: statement.range,
            loc: statement.loc
        }
        if (statement.initialValue.type === "FunctionCall" && statement.initialValue.expression.type === "Identifier") {
            vulnerability.functionCall = statement.initialValue.expression.name
        }

    }
    return vulnerability
}