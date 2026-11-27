/**
 * Local ESLint rule: ONE React component per source file (owner FE principle
 * 2026-11-27). Helpers, hooks and typed data may share the file; a second
 * function/constant whose name starts with an uppercase letter AND renders JSX
 * is a component and must live in its own file.
 *
 * Detected component shapes: named function declarations, function/arrow
 * initializers, `memo(...)` / `forwardRef(...)` wrappers, conditional-expression
 * initializers, classes whose `render()` returns JSX, anonymous default-export
 * functions/arrows and class expressions.
 *
 * Tests/specs are fixtures, not product components, and are exempt.
 *
 * Pre-existing multi-component modules that are NOT part of this UX fix are
 * grandfathered BY NAME (not by whole file): adding a new component to one of
 * them is still an error. The lists below are stable exceptions; do not grow
 * them when adding a component to a file.
 */
const COMPONENT_NAME = /^[A-Z]/;
const COMPONENT_WRAPPERS = new Set(['memo', 'forwardRef']);

const GRANDFATHERED = {
  // Legacy art/scene modules untouched by the round-5 UX fix.
  'src/scene/Room.tsx': ['Books', 'ClutterFamily', 'RoomScene', 'Room'],
  'src/ui/PostBook.tsx': ['PostBook'],
  // Shared presentational primitives; only a single cast line was retyped here.
  'src/ui/primitives.tsx': [
    'DisplayTitle',
    'TagChip',
    'StarMark',
    'GitHubIcon',
    'LinkedInIcon',
  ],
};

function rendersJsx(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') return true;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) {
      for (const item of value) if (rendersJsx(item)) return true;
    } else if (
      value &&
      typeof value === 'object' &&
      typeof value.type === 'string'
    ) {
      if (rendersJsx(value)) return true;
    }
  }
  return false;
}

/** `memo`, `React.memo`, `forwardRef`, `React.forwardRef`, … */
function calleeName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property?.type === 'Identifier'
  ) {
    return node.property.name;
  }
  return null;
}

/** True for a class with a `render()` method whose body returns JSX. */
function classRendersJsx(node) {
  const members = node.body?.body ?? [];
  return members.some((member) => {
    if (member.type !== 'MethodDefinition' && member.type !== 'Property') {
      return false;
    }
    if (member.computed) return false;
    const key = member.key?.name ?? member.key?.value;
    if (key !== 'render') return false;
    return rendersJsx(member.value ?? member);
  });
}

/**
 * Inspect an initializer for component shapes.
 *
 * Returns `nodes` (function-like nodes whose bodies must be checked for JSX)
 * and `definite` (true when the initializer is a component by construction:
 * a memo/forwardRef wrapper or a class with a JSX `render()`).
 */
function analyzeInit(init) {
  if (!init) return { nodes: [], definite: false };
  if (init.type === 'CallExpression') {
    const name = calleeName(init.callee);
    if (name && COMPONENT_WRAPPERS.has(name)) {
      // `memo(Impl)` is a component even when `Impl` is imported from elsewhere.
      const inner = analyzeInit(init.arguments?.[0]);
      return { nodes: inner.nodes, definite: true };
    }
    return { nodes: [], definite: false };
  }
  if (init.type === 'ConditionalExpression') {
    const consequent = analyzeInit(init.consequent);
    const alternate = analyzeInit(init.alternate);
    return {
      nodes: [...consequent.nodes, ...alternate.nodes],
      definite: consequent.definite || alternate.definite,
    };
  }
  if (
    init.type === 'ArrowFunctionExpression' ||
    init.type === 'FunctionExpression'
  ) {
    return { nodes: [init], definite: false };
  }
  if (init.type === 'ClassExpression' && classRendersJsx(init)) {
    return { nodes: [], definite: true };
  }
  return { nodes: [], definite: false };
}

export const oneComponentPerFile = {
  meta: {
    type: 'problem',
    docs: {
      description: 'allow only one React component per source file',
    },
    messages: {
      multipleComponents:
        '"{{name}}" is a second component in this file. Move it into its own file (one component per file).',
    },
    schema: [],
  },
  create(context) {
    const filename = String(
      context.filename ?? context.getFilename?.() ?? '',
    ).replace(/\\/g, '/');
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)) return {};

    const components = [];

    function record(name, node, force = false) {
      if (typeof name !== 'string' || !COMPONENT_NAME.test(name)) return;
      if (!force && !rendersJsx(node)) return;
      components.push({ name, node });
    }

    return {
      FunctionDeclaration(node) {
        record(node.id?.name, node);
      },
      VariableDeclarator(node) {
        if (node.id?.type !== 'Identifier') return;
        const { nodes, definite } = analyzeInit(node.init);
        if (!definite && !nodes.some(rendersJsx)) return;
        record(node.id.name, node.init ?? node, true);
      },
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration;
        if (!declaration) return;
        if (declaration.type === 'FunctionDeclaration') {
          // Named default functions are already visited by FunctionDeclaration.
          if (declaration.id?.name) return;
          record('Default', declaration, rendersJsx(declaration));
          return;
        }
        if (
          declaration.type === 'ArrowFunctionExpression' ||
          declaration.type === 'FunctionExpression'
        ) {
          record('Default', declaration, rendersJsx(declaration));
          return;
        }
        if (declaration.type === 'CallExpression') {
          const { nodes, definite } = analyzeInit(declaration);
          if (definite || nodes.some(rendersJsx)) {
            record('Default', declaration, true);
          }
        }
      },
      ClassDeclaration(node) {
        record(node.id?.name, node, classRendersJsx(node));
      },
      'Program:exit'() {
        const path = filename.replace(/^.*\/src\//, 'src/');
        const exempt = GRANDFATHERED[path] ?? [];
        for (const extra of components.slice(1)) {
          if (exempt.includes(extra.name)) continue;
          context.report({
            node: extra.node,
            messageId: 'multipleComponents',
            data: { name: extra.name },
          });
        }
      },
    };
  },
};

export default oneComponentPerFile;
