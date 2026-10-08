// Parse-floor gate (same rule as ordotype-scripts). The live finder files are served
// RAW from jsDelivr to old hospital browsers (Chrome 78 / Safari 12). With ecmaVersion
// 2019, any ES2020+ SYNTAX (?., ??, ??=, class fields...) is a PARSE error in this lint
// run - Sentry ORDOTYPE-FRONTEND-1F6, where one token kept the whole finder from
// starting on those browsers (125 people over 80 days).
// No style rules on purpose: this gate checks parseability only.
// Run ./check-parse-floor.sh: it lints only the files the site loads (list taken from
// build-search-result-bundle.sh); the dated archives are history and are not checked.
module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: "script",
    },
    rules: {},
  },
];
