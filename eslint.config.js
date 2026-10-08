// Parse-floor gate: the finder files are served raw from jsDelivr and must parse as
// ES2019 (older browsers). Any ES2020+ syntax (?., ??, class fields...) fails here.
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
