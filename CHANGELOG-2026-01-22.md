# Changelog - ordotype-index-2026-01-22.js

## Bug Fix: TypeError searchResultInner.appendChild is not a function

### Issue
Sentry reported the following error:
```
TypeError: searchResultInner.appendChild is not a function
    at displayResults (ordotype-index-2025-09-26-c.js:519:23)
```

### Root Cause
In the `displayResults()` function, `searchResultInner` was initialized as an empty string (`""`).

When `resultList` (the `#search-results` div) already existed but didn't contain the `#filter` element, `searchResultInner` remained a string instead of becoming a DOM element.

Subsequently, calling `.appendChild()` on a string caused the TypeError.

### Fixes Applied

1. **Guard for `fromSuggest` block (line 512)**
   ```javascript
   // Before
   if (fromSuggest) {

   // After
   if (fromSuggest && searchResultInner && typeof searchResultInner.appendChild === 'function') {
   ```

2. **Early return before results loop (line 523)**
   ```javascript
   if (!searchResultInner || typeof searchResultInner.appendChild !== 'function') return;
   ```

3. **Null check for `result.filtres` (line 524)**
   ```javascript
   // Before
   if (result.filtres.includes("only"))

   // After
   if (result.filtres && result.filtres.includes("only"))
   ```
   This prevents a potential `Cannot read property 'includes' of undefined` error.

4. **Null check for `searchResultOriginal` (line 471)**
   ```javascript
   let searchResultOriginal = searchBarMain ? document.querySelector('#search-result') : document.querySelector('#search-result-nav');
   if (!searchResultOriginal) return;
   ```
   This prevents `TypeError: can't access property "cloneNode", searchResultOriginal is null` when the template element doesn't exist in the DOM.

### Testing
Deploy to staging and test:
- Search with results
- Search with no results (triggers suggestions via `fromSuggest`)
- Filter by category then search
- Focus on search bar with existing query
