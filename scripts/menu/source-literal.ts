import fs from 'node:fs';

import { parse } from '@babel/parser';

type BabelNode = {
  type: string;
  [key: string]: unknown;
};

function isLiteralNode(node: BabelNode): boolean {
  return (
    node.type === 'ArrayExpression' ||
    node.type === 'BooleanLiteral' ||
    node.type === 'Identifier' ||
    node.type === 'NullLiteral' ||
    node.type === 'NumericLiteral' ||
    node.type === 'ObjectExpression' ||
    node.type === 'StringLiteral'
  );
}

function propertyKeyToString(key: BabelNode): string {
  if (key.type === 'Identifier') return key.name as string;
  if (key.type === 'StringLiteral') return key.value as string;
  if (key.type === 'NumericLiteral') return String(key.value);
  throw new Error(`Unsupported object literal key type: ${key.type}`);
}

function evaluateLiteral(node: BabelNode): unknown {
  switch (node.type) {
    case 'ArrayExpression':
      return (node.elements as Array<BabelNode | null>).map((element) => {
        if (!element || element.type === 'SpreadElement' || !isLiteralNode(element)) {
          throw new Error('Unsupported array source expression.');
        }
        return evaluateLiteral(element);
      });
    case 'BooleanLiteral':
    case 'NumericLiteral':
    case 'StringLiteral':
      return node.value;
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      throw new Error(`Unsupported identifier in source literal: ${node.name as string}`);
    case 'NullLiteral':
      return null;
    case 'ObjectExpression': {
      const output: Record<string, unknown> = {};
      for (const property of node.properties as BabelNode[]) {
        if (property.type === 'SpreadElement' || property.type === 'ObjectMethod') {
          throw new Error('Unsupported object source expression.');
        }
        const value = property.value as BabelNode;
        if (!isLiteralNode(value)) {
          throw new Error('Unsupported object source value.');
        }
        output[propertyKeyToString(property.key as BabelNode)] = evaluateLiteral(value);
      }
      return output;
    }
    default:
      throw new Error(`Unsupported source expression: ${node.type}`);
  }
}

function findWindowAssignment(ast: BabelNode, exportName: string): BabelNode | null {
  const program = ast.program as BabelNode;
  for (const statement of program.body as BabelNode[]) {
    if (statement.type !== 'ExpressionStatement') continue;
    const expression = statement.expression as BabelNode;
    if (expression.type !== 'AssignmentExpression') continue;

    const left = expression.left as BabelNode;
    const object = left.object as BabelNode | undefined;
    const property = left.property as BabelNode | undefined;
    if (
      left.type === 'MemberExpression' &&
      object?.type === 'Identifier' &&
      object.name === 'window' &&
      property?.type === 'Identifier' &&
      property.name === exportName
    ) {
      return expression.right as BabelNode;
    }
  }
  return null;
}

export function loadWindowAssignedObjectLiteral<T>(filePath: string, exportName: string): T {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const ast = parse(sourceText, {
    sourceType: 'script',
    allowReturnOutsideFunction: false,
    errorRecovery: false,
  }) as unknown as BabelNode;
  const expression = findWindowAssignment(ast, exportName);
  if (!expression || !isLiteralNode(expression)) {
    throw new Error(`Failed to find safe window.${exportName} object literal in ${filePath}.`);
  }
  return evaluateLiteral(expression) as T;
}
