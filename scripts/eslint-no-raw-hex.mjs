/**
 * Local ESLint rule: ban raw hex color literals outside the canonical token
 * store (src/styles/design-tokens.ts + design-tokens.json).
 *
 * Allowlists (deliberate, narrow):
 *   - the token store itself — the one place raw hex is allowed;
 *   - the LEVEL_COLORS declaration in src/lib/climate.ts ONLY (scoped by AST,
 *     not by file): it is a DATA SCALE (7 weather levels), intentionally not a
 *     design token, and must never be recolored here. Any other hex literal in
 *     climate.ts is still reported;
 *   - test/spec files (`*.test.*` / `*.spec.*`, anywhere — including
 *     scripts/qa/*.spec.ts) — they assert exact hex strings as fixtures;
 *   - the index.html critical CSS block is HTML, not linted by ESLint (the
 *     sibling css-hex-guard.mjs covers .css files instead).
 */
const HEX_COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi;

const CLIMATE_FILE = /(?:^|\/)src\/lib\/climate\.ts$/;

function isAllowlisted(filename) {
  const path = String(filename).replace(/\\/g, '/');
  // (?:^|/) matches both RuleTester's relative names and ESLint's absolute ones.
  if (/(?:^|\/)src\/styles\/design-tokens\.(?:ts|json)$/.test(path))
    return true;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) return true; // fixtures (covers scripts/qa/*.spec.ts)
  if (/(?:^|\/)tests\//.test(path)) return true;
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
    const filename = context.filename ?? context.getFilename?.();
    if (isAllowlisted(filename)) {
      return {};
    }
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    // Narrow exemption: inside src/lib/climate.ts, ONLY hex literals within
    // the LEVEL_COLORS declaration are allowed — the rest of the file is
    // linted like any other module.
    const climateScoped = CLIMATE_FILE.test(
      String(filename).replace(/\\/g, '/'),
    );

    function insideLevelColors(node) {
      const ancestors =
        sourceCode.getAncestors?.(node) ??
        (() => {
          const chain = [];
          for (let p = node.parent; p; p = p.parent) chain.push(p);
          return chain;
        })();
      return ancestors.some(
        (ancestor) =>
          ancestor.type === 'VariableDeclarator' &&
          ancestor.id?.name === 'LEVEL_COLORS',
      );
    }

    function check(node) {
      if (climateScoped && insideLevelColors(node)) return;
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
