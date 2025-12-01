/**
 * TypeScript Parser
 *
 * Uses the TypeScript compiler API to accurately parse imports, exports,
 * classes, functions, and other declarations from TypeScript files.
 */

import * as ts from 'typescript';
import * as path from 'path';
import type {
  FileInfo,
  ImportInfo,
  ExportInfo,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
} from './types.js';

/**
 * Parse a TypeScript file and extract its structure
 */
export function parseTypeScriptFile(filePath: string, content: string, rootDir: string): FileInfo {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const classes: ClassInfo[] = [];
  const functions: FunctionInfo[] = [];
  const interfaces: string[] = [];
  const types: string[] = [];
  const constants: string[] = [];

  // Visit each node in the AST
  function visit(node: ts.Node): void {
    // Parse import declarations
    if (ts.isImportDeclaration(node)) {
      const importInfo = parseImportDeclaration(node);
      if (importInfo) {
        imports.push(importInfo);
      }
    }

    // Parse export declarations
    if (ts.isExportDeclaration(node)) {
      const exportInfos = parseExportDeclaration(node);
      exports.push(...exportInfos);
    }

    // Parse exported class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      const classInfo = parseClassDeclaration(node);
      if (classInfo) {
        classes.push(classInfo);
        if (hasExportModifier(node)) {
          exports.push({ name: classInfo.name, type: 'class' });
        }
      }
    }

    // Parse exported function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      const funcInfo = parseFunctionDeclaration(node);
      if (funcInfo) {
        functions.push(funcInfo);
        if (hasExportModifier(node)) {
          exports.push({ name: funcInfo.name, type: 'function' });
        }
      }
    }

    // Parse interface declarations
    if (ts.isInterfaceDeclaration(node) && node.name) {
      interfaces.push(node.name.text);
      if (hasExportModifier(node)) {
        exports.push({ name: node.name.text, type: 'interface' });
      }
    }

    // Parse type alias declarations
    if (ts.isTypeAliasDeclaration(node) && node.name) {
      types.push(node.name.text);
      if (hasExportModifier(node)) {
        exports.push({ name: node.name.text, type: 'type' });
      }
    }

    // Parse variable declarations (const)
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          constants.push(decl.name.text);
          if (hasExportModifier(node)) {
            exports.push({ name: decl.name.text, type: 'const' });
          }
        }
      }
    }

    // Parse enum declarations
    if (ts.isEnumDeclaration(node) && node.name) {
      constants.push(node.name.text);
      if (hasExportModifier(node)) {
        exports.push({ name: node.name.text, type: 'enum' });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Determine file type based on content
  const fileType = determineFileType(filePath, classes, functions, interfaces, types, constants);

  return {
    path: filePath,
    relativePath: path.relative(rootDir, filePath),
    type: fileType,
    imports,
    exports,
    classes,
    functions,
    interfaces,
    types,
    constants,
    dependencies: [],
    usedBy: [],
  };
}

/**
 * Check if a node has an export modifier
 */
function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/**
 * Parse an import declaration
 */
function parseImportDeclaration(node: ts.ImportDeclaration): ImportInfo | null {
  const moduleSpecifier = node.moduleSpecifier;
  if (!ts.isStringLiteral(moduleSpecifier)) {
    return null;
  }

  const module = moduleSpecifier.text;
  const items: string[] = [];
  let typeOnly = false;

  // Check if it's a type-only import
  if (node.importClause?.isTypeOnly) {
    typeOnly = true;
  }

  const importClause = node.importClause;
  if (importClause) {
    // Default import
    if (importClause.name) {
      items.push(importClause.name.text);
    }

    // Named imports
    const namedBindings = importClause.namedBindings;
    if (namedBindings) {
      if (ts.isNamespaceImport(namedBindings)) {
        // import * as name
        items.push(`* as ${namedBindings.name.text}`);
      } else if (ts.isNamedImports(namedBindings)) {
        // import { a, b, c }
        for (const element of namedBindings.elements) {
          if (element.isTypeOnly) {
            typeOnly = true;
          }
          items.push(element.name.text);
        }
      }
    }
  }

  return {
    module,
    items,
    typeOnly: typeOnly || undefined,
  };
}

/**
 * Parse an export declaration
 */
function parseExportDeclaration(node: ts.ExportDeclaration): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // Re-export from another module
  if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    const from = node.moduleSpecifier.text;

    if (node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push({
            name: element.name.text,
            type: 'reexport',
            from,
          });
        }
      } else if (ts.isNamespaceExport(node.exportClause)) {
        exports.push({
          name: '*',
          type: 'reexport',
          from,
        });
      }
    } else {
      // export * from 'module'
      exports.push({
        name: '*',
        type: 'reexport',
        from,
      });
    }
  }

  return exports;
}

/**
 * Parse a class declaration
 */
function parseClassDeclaration(node: ts.ClassDeclaration): ClassInfo | null {
  if (!node.name) {
    return null;
  }

  const name = node.name.text;
  const methods: MethodInfo[] = [];
  const properties: string[] = [];
  let extendsClass: string | undefined;
  const implementsInterfaces: string[] = [];
  let constructorInfo: ClassInfo['constructor'];

  // Get heritage clauses (extends, implements)
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        for (const type of clause.types) {
          if (ts.isIdentifier(type.expression)) {
            extendsClass = type.expression.text;
          }
        }
      } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        for (const type of clause.types) {
          if (ts.isIdentifier(type.expression)) {
            implementsInterfaces.push(type.expression.text);
          }
        }
      }
    }
  }

  // Parse class members
  for (const member of node.members) {
    // Constructor
    if (ts.isConstructorDeclaration(member)) {
      const params: string[] = [];
      const dependencies: string[] = [];

      for (const param of member.parameters) {
        if (ts.isIdentifier(param.name)) {
          params.push(param.name.text);

          // Check for dependency injection (type annotation)
          if (param.type && ts.isTypeReferenceNode(param.type)) {
            if (ts.isIdentifier(param.type.typeName)) {
              dependencies.push(param.type.typeName.text);
            }
          }
        }
      }

      constructorInfo = { params, dependencies };
    }

    // Methods
    if (ts.isMethodDeclaration(member) && member.name) {
      const methodName = ts.isIdentifier(member.name)
        ? member.name.text
        : ts.isStringLiteral(member.name)
          ? member.name.text
          : '';

      if (methodName) {
        const methodInfo: MethodInfo = {
          name: methodName,
          params: member.parameters.map(p =>
            ts.isIdentifier(p.name) ? p.name.text : ''
          ),
        };

        // Try to determine return type
        if (member.type) {
          methodInfo.returns = member.type.getText();
        }

        // Look for delegation patterns in the method body
        if (member.body) {
          const delegatesTo = findDelegation(member.body);
          if (delegatesTo) {
            methodInfo.delegatesTo = delegatesTo;
          }

          const calls = findMethodCalls(member.body);
          if (calls.length > 0) {
            methodInfo.calls = calls;
          }
        }

        methods.push(methodInfo);
      }
    }

    // Properties
    if (ts.isPropertyDeclaration(member) && member.name) {
      const propName = ts.isIdentifier(member.name) ? member.name.text : '';
      if (propName) {
        properties.push(propName);
      }
    }
  }

  return {
    name,
    methods,
    properties,
    constructor: constructorInfo,
    extends: extendsClass,
    implements: implementsInterfaces.length > 0 ? implementsInterfaces : undefined,
  };
}

/**
 * Find delegation patterns like `return this.someManager.method()`
 */
function findDelegation(body: ts.Block): string | undefined {
  let delegation: string | undefined;

  function visit(node: ts.Node): void {
    if (ts.isReturnStatement(node) && node.expression) {
      if (ts.isCallExpression(node.expression)) {
        const expr = node.expression.expression;
        if (ts.isPropertyAccessExpression(expr)) {
          const obj = expr.expression;
          if (ts.isPropertyAccessExpression(obj)) {
            // this.manager.method pattern
            const managerName = obj.name.text;
            // Convert camelCase to PascalCase for class name
            delegation = managerName.charAt(0).toUpperCase() + managerName.slice(1);
            // Remove 'Manager' prefix if it exists for better matching
            if (!delegation.endsWith('Manager') && !delegation.endsWith('Search')) {
              delegation = delegation + 'Manager';
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return delegation;
}

/**
 * Find method calls in a function body
 */
function findMethodCalls(body: ts.Block): string[] {
  const calls: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const obj = expr.expression;
        const method = expr.name.text;

        if (ts.isPropertyAccessExpression(obj)) {
          // this.something.method()
          const target = obj.name.text;
          calls.push(`${target}.${method}`);
        } else if (ts.isIdentifier(obj)) {
          // something.method()
          calls.push(`${obj.text}.${method}`);
        }
      } else if (ts.isIdentifier(expr)) {
        // function()
        calls.push(expr.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return [...new Set(calls)]; // Remove duplicates
}

/**
 * Parse a function declaration
 */
function parseFunctionDeclaration(node: ts.FunctionDeclaration): FunctionInfo | null {
  if (!node.name) {
    return null;
  }

  const name = node.name.text;
  const params = node.parameters.map(p =>
    ts.isIdentifier(p.name) ? p.name.text : ''
  );

  let returns: string | undefined;
  if (node.type) {
    returns = node.type.getText();
  }

  const calls: string[] = [];
  if (node.body) {
    // Find function calls within the body
    function visit(n: ts.Node): void {
      if (ts.isCallExpression(n)) {
        if (ts.isIdentifier(n.expression)) {
          calls.push(n.expression.text);
        } else if (ts.isPropertyAccessExpression(n.expression)) {
          calls.push(n.expression.name.text);
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(node.body);
  }

  return {
    name,
    params,
    returns,
    exported: hasExportModifier(node),
    calls: [...new Set(calls)],
  };
}

/**
 * Determine the type of file based on its content
 */
function determineFileType(
  filePath: string,
  classes: ClassInfo[],
  functions: FunctionInfo[],
  interfaces: string[],
  types: string[],
  constants: string[]
): FileInfo['type'] {
  const fileName = path.basename(filePath, '.ts');

  // Check for specific file patterns
  if (fileName === 'index') {
    return 'entry';
  }

  if (filePath.includes('/types/') || fileName.endsWith('.types')) {
    return 'types';
  }

  if (fileName === 'constants') {
    return 'constants';
  }

  if (fileName === 'errors') {
    return 'errors';
  }

  if (fileName === 'tfidf' || fileName === 'levenshtein') {
    return 'algorithm';
  }

  if (fileName.includes('Cache') || fileName === 'searchCache') {
    return 'cache';
  }

  if (classes.length > 0) {
    return 'class';
  }

  if (filePath.includes('/utils/')) {
    return 'utility';
  }

  return 'module';
}

/**
 * Extract the file name without path
 */
export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Get relative path from source directory
 */
export function getRelativePath(filePath: string, srcDir: string): string {
  return path.relative(srcDir, filePath);
}
