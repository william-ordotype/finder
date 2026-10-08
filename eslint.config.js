// Parse-floor gate (same rule as ordotype-scripts). The live finder files are served
// RAW from jsDelivr to old hospital browsers (Chrome 78 / Safari 12). With ecmaVersion
// 2019, any ES2020+ SYNTAX (?., ??, ??=, class fields...) is a PARSE error in this lint
// run - Sentry ORDOTYPE-FRONTEND-1F6, where one token kept the whole finder from
// starting on those browsers (125 people over 80 days).
// Only the files the site loads are checked; the dated archives are history.
// No style rules on purpose: this gate checks parseability only.
// Run: npx --yes eslint@10   (also run by .github/workflows/parse-floor.yml)
module.exports = [
  {
    files: [
      "ordotype-index-2026-04-07.js",
      "search-result-filter-2026-01-22.js",
      "search-result-bundle.js",
    ],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: "script",
    },
    rules: {},
  },
];
