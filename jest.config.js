module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    "src/components/*.{js,jsx,vue}",
    "src/store/*.{js,jsx,vue}",
  ],
  preset: "@vue/cli-plugin-unit-jest",
};
