/**
 * Local ESLint rule: ONE React component per source file (owner FE principle
 * 2026-11-27). Helpers, hooks and typed data may share the file; a second
 * function/constant whose name starts with an uppercase letter AND renders JSX
 * is a component and must live in its own file.
 *
 * Tests/specs are fixtures, not product components, and are exempt.
 *
 * Pre-existing multi-component modules that are NOT part of this UX fix are
 * grandfathered BY NAME (not by whole file): adding a new component to one of
 * them is still an error. They will be split in a dedicated cleanup task.
 */
const COMPONENT_NAME = /^[A-Z]/;

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

    function record(name, node) {
      if (typeof name !== 'string' || !COMPONENT_NAME.test(name)) return;
      if (!rendersJsx(node)) return; // uppercase constant/data, not a component
      components.push({ name, node });
    }

    return {
      FunctionDeclaration(node) {
        record(node.id?.name, node);
      },
      VariableDeclarator(node) {
        if (node.id?.type !== 'Identifier') return;
        const init = node.init;
        if (
          init?.type === 'ArrowFunctionExpression' ||
          init?.type === 'FunctionExpression'
        ) {
          record(node.id.name, init);
        }
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
