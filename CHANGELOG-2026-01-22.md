# Changelog - 2026-01-22

## ordotype-index-2026-01-22.js

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

---

## search-result-2026-01-22.js

### Issues Fixed
Multiple potential `TypeError: Cannot read property of null` errors when DOM elements don't exist.

### Fixes Applied

1. **Line 33** - Added optional chaining for `#search-btn`:
   ```javascript
   // Before
   document.getElementById("search-btn").addEventListener('click', ...

   // After
   document.getElementById("search-btn")?.addEventListener('click', ...
   ```

2. **Line 34** - Added null checks for search bar value:
   ```javascript
   // Before
   const query = document.getElementById("search-bar-main").value.trim()

   // After
   const query = document.getElementById("search-bar-main")?.value?.trim();
   if (query) window.location.href = ...
   ```

3. **Line 150-152** - Added null check for `#search-title`:
   ```javascript
   // Before
   let searchTitle = document.getElementById('search-title')
   searchTitle.innerHTML = '';

   // After
   let searchTitle = document.getElementById('search-title');
   if (searchTitle) {
     searchTitle.innerHTML = ...
   }
   ```

4. **Line 162** - Return empty array on error in `searchAll()`:
   ```javascript
   } catch (error) {
     console.error(error);
     return [];  // Added - prevents undefined.length error
   }
   ```

5. **Line 168** - Added null check for `#pagination`:
   ```javascript
   const paginationDiv = document.getElementById('pagination');
   if (!paginationDiv) return;
   ```

6. **Line 253-258** - Added null checks in `displayAll()`:
   ```javascript
   // Before
   if (results.length == 0)

   // After
   if (!results || results.length === 0)

   // Also added:
   if (!resultList) return;
   ```

7. **Line 256** - Added null check for `#suggestions`:
   ```javascript
   const suggestionsEl = document.getElementById('suggestions');
   if (suggestionsEl) suggestionsEl.innerText = '';
   ```

---

### Testing
Deploy to staging and test:
- Search with results
- Search with no results (triggers suggestions via `fromSuggest`)
- Filter by category then search
- Focus on search bar with existing query
- Test on /search-result page with pagination
