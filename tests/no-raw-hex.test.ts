/**
 * Fixtures for the local ESLint hex-ban rule itself: valid cases (token role,
 * allowlisted files, non-colors) and invalid cases (3/6/8-digit hex, hex inside
 * a template literal). Guards against a rule that silently never fires.
 */
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { noRawHex } from '../scripts/eslint-no-raw-hex.mjs';

// Wire RuleTester to vitest explicitly instead of relying on vitest globals
// being enabled in this environment (they are a config flag, not a guarantee).
RuleTester.describe = describe;
RuleTester.it = it;

describe('local/no-raw-hex lint rule', () => {
  const tester = new RuleTester();

  tester.run('no-raw-hex', noRawHex, {
    valid: [
      {
        filename: 'src/ui/Widget.tsx',
        code: "import { DESIGN_TOKENS } from '../styles/design-tokens';\nconst c = DESIGN_TOKENS.p5.red;",
      },
      {
        filename: 'src/styles/design-tokens.ts',
        code: "export const red = '#ff0000';",
      },
      {
        // Scoped exemption: only the LEVEL_COLORS declaration is allowlisted.
        filename: 'src/lib/climate.ts',
        code: "export const LEVEL_COLORS = ['#6b7280'];",
      },
      {
        filename: 'tests/widget.test.ts',
        code: "expect(color).toBe('#ff0000');",
      },
      {
        // scripts/qa Playwright specs are covered by the *.spec.ts fixture rule.
        filename: 'scripts/qa/capture.spec.ts',
        code: "expect(color).toBe('#ff0000');",
      },
      {
        filename: 'src/ui/Widget.tsx',
        code: 'const href = "#section";',
      },
      {
        filename: 'src/ui/Widget.tsx',
        code: 'const c = `rgb(0, 0, 0)`;',
      },
    ],
    invalid: [
      {
        filename: 'src/ui/Widget.tsx',
        code: "const c = '#ff0000';",
        errors: [{ messageId: 'rawHex' }],
      },
      {
        // climate.ts is no longer a blanket exemption: hex outside the
        // LEVEL_COLORS declaration must be reported.
        filename: 'src/lib/climate.ts',
        code: "const c = '#ff0000';\nexport const LEVEL_COLORS = ['#6b7280'];",
        errors: [{ messageId: 'rawHex' }],
      },
      {
        filename: 'src/scene/art/materials.ts',
        code: "const c = '#abc';",
        errors: [{ messageId: 'rawHex' }],
      },
      {
        filename: 'src/scene/art/materials.ts',
        code: "const c = '#11223344';",
        errors: [{ messageId: 'rawHex' }],
      },
      {
        filename: 'src/ui/Widget.tsx',
        code: 'const c = `color:#abcdef`;',
        errors: [{ messageId: 'rawHex' }],
      },
    ],
  });
});
