/**
 * Local ESLint rule: ban raw hex color literals outside the canonical token
 * store (src/styles/design-tokens.ts + design-tokens.json).
 *
 * Allowlists (deliberate, narrow):
 *   - the token store itself — the one place raw hex is allowed;
 *   - src/lib/climate.ts — LEVEL_COLORS is a DATA SCALE (7 weather levels),
 *     intentionally not a design token, and must never be recolored here;
 *   - test/spec files — they assert exact hex strings as fixtures;
 *   - the index.html critical CSS block is HTML, not linted by ESLint (the
 *     sibling css-hex-guard.mjs covers .css files instead).
 */
const HEX_COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi;

function isAllowlisted(filename) {
  const path = String(filename).replace(/\\/g, '/');
  // (?:^|/) matches both RuleTester's relative names and ESLint's absolute ones.
  if (/(?:^|\/)src\/styles\/design-tokens\.(?:ts|json)$/.test(path))
    return true;
  if (/(?:^|\/)src\/lib\/climate\.ts$/.test(path)) return true; // LEVEL_COLORS
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) return true; // fixtures
  if (/(?:^|\/)tests\//.test(path)) return true;
  if (/(?:^|\/)scripts\/qa\//.test(path)) return true; // Playwright specs
  return false;
}

export const noRawHex = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow raw hex color literals outside the canonical design-token module',
    },
    messages: {
      rawHex:
        'Raw hex color literal "{{hex}}" is banned. Import a named role from src/styles/design-tokens.ts instead.',
    },
    schema: [],
  },
  create(context) {
    if (isAllowlisted(context.filename ?? context.getFilename?.())) {
      return {};
    }
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function check(node) {
      const text = sourceCode.getText(node);
      for (const match of text.matchAll(HEX_COLOR)) {
        context.report({
          node,
          messageId: 'rawHex',
          data: { hex: match[0] },
        });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string' || typeof node.value === 'number') {
          check(node);
        }
      },
      TemplateElement(node) {
        check(node);
      },
    };
  },
};

export default noRawHex;
