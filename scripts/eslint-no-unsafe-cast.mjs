/**
 * Local ESLint rule: no unsafe TypeScript casts (owner FE principle
 * 2026-11-27). `as unknown`, `as any`, `as never` and angle-bracket assertions
 * erase or bypass the type checker; use a guard, a typed map or a properly
 * typed value instead. Ordinary `as` to a related DOM/R3F type is allowed —
 * the dangerous escape hatches are the ones that defeat strong typing.
 *
 * Tests/specs are fixtures and are exempt.
 */
function unsafeType(typeNode) {
  if (!typeNode) return false;
  // `as unknown as T` / `as any as T` is reported by the inner TSAsExpression
  // node on its own keyword type annotation. Type annotations are type nodes
  // (keywords or references), never TSAsExpression nodes, so only the three
  // keyword escape hatches can reach here.
  return (
    typeNode.type === 'TSUnknownKeyword' ||
    typeNode.type === 'TSAnyKeyword' ||
    typeNode.type === 'TSNeverKeyword'
  );
}

export const noUnsafeCast = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow type-erasing casts such as `as unknown` and `as any`',
    },
    messages: {
      unsafeCast:
        'Unsafe cast "{{text}}". Use a proper type, a type guard or a typed map instead.',
    },
    schema: [],
  },
  create(context) {
    const filename = String(
      context.filename ?? context.getFilename?.() ?? '',
    ).replace(/\\/g, '/');
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)) return {};
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function check(node, typeNode) {
      if (!unsafeType(typeNode)) return;
      context.report({
        node,
        messageId: 'unsafeCast',
        data: { text: sourceCode.getText(node) },
      });
    }

    return {
      TSAsExpression(node) {
        check(node, node.typeAnnotation);
      },
      TSTypeAssertion(node) {
        check(node, node.typeAnnotation);
      },
    };
  },
};

export default noUnsafeCast;
