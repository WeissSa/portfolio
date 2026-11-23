# Third-party notices

Informational inventory of third-party packages and assets shipped with the portfolio. Each package's own `LICENSE` file in `node_modules/` remains authoritative; this notice is not a license grant.

| Component                    | Version range | License                                                                            | Project                                     |
| ---------------------------- | ------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| React, React DOM             | ^19.3.1       | MIT                                                                                | https://react.dev/                          |
| @mantine/core                | ^9.8.2        | MIT                                                                                | https://mantine.dev/                        |
| @mantine/hooks               | ^9.8.2        | MIT                                                                                | https://mantine.dev/                        |
| @gfazioli/mantine-book       | ^1.0.17       | MIT                                                                                | https://github.com/gfazioli/mantine-book    |
| @zumer/snapdom               | ^2.12.2       | MIT                                                                                | https://github.com/zumerlab/snapdom         |
| three.js                     | ^0.187.0      | MIT                                                                                | https://threejs.org/                        |
| @react-three/fiber           | ^9.8.2        | MIT                                                                                | https://github.com/pmndrs/react-three-fiber |
| @react-three/drei            | ^10.7.9       | MIT                                                                                | https://github.com/pmndrs/drei              |
| zustand                      | ^5.1.0        | MIT                                                                                | https://github.com/pmndrs/zustand           |
| axe-core (dev/test)          | ^4.14.1       | MPL-2.0                                                                            | https://github.com/dequelabs/axe-core       |
| @playwright/test (dev/CI)    | ^1.65.1       | Apache-2.0                                                                         | https://github.com/microsoft/playwright     |
| Anton font (Latin 400 woff2) | vendored      | SIL Open Font License 1.1 (`public/fonts/ANTON-OFL.txt`, shipped in `dist/fonts/`) | https://fonts.google.com/specimen/Anton     |

`@zumer/snapdom` ships transitively via `@gfazioli/mantine-book`: it is emitted only in the book package's rounded-variant lazy WebGL chunk, which the flat integration never fetches.

Build/test tooling (Vite, TypeScript, ESLint, Prettier, Vitest, Tailwind, size-limit, jsdom) is MIT-licensed unless its package states otherwise. The CI license audit (`license-checker`) is informational: a new dependency's license is reported in the workflow log but does not fail the build automatically.
