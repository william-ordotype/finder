// ---------- Config ----------
const ES_BASE_URL = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";
const ES_INDEX_STAGING = "ordotype-index-2026-05-28-c";
const ES_INDEX_PRODUCTION = "ordotype-index-2026-05-28-c";

// Choose index by environment: staging (webflow) vs production
const IS_STAGING = window.location.hostname.includes("ordotype.webflow.io");
const ES_INDEX = IS_STAGING ? ES_INDEX_STAGING : ES_INDEX_PRODUCTION;

// Final Elasticsearch URL
const ES_URL = `${ES_BASE_URL}${ES_INDEX}`;

const baseUrl = window.location.origin;

let currentFocus;

// Blocklist: queries with no matching fiche — return empty results
// instead of misleading fuzzy matches. Remove a term when its fiche is created.
// See: https://www.notion.so/ordotype/32f30a1b750f81a0ab35fdcdc6b4a910
var BLOCKED_QUERIES = new Set([
  "lupus", "hyponatremie", "tuberculose", "tdah", "gingivite",
  "meningite", "cushing", "pericardite", "horton", "souffle",
  "pied main", "pied-main", "pied main bouche", "pied-main-bouche", "pied-main bouche", "syndrome pied main bouche", "syndrome pied-main-bouche"
]);

function normalizeForBlocklist(q) {
  return q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Handle click outside of search results
document.addEventListener("click", ({ target }) => {
  const searchResults = document.getElementById("search-results");
  if (searchResults && !searchResults.contains(target)) {
    searchResults.remove();
  }
});

const searchBarNav = document.getElementById("search-bar-nav");
const searchBarMain = document.getElementById("search-bar-main");
let searchBar;
if (window.location.pathname.includes("search-result") && window.innerWidth > 767) {
  searchBar = searchBarNav;
} else {
  searchBar = searchBarMain || searchBarNav;
}

var lastActiveTab = 'Tab 1';
//var activeFilter = getItemWithExpiration('filterTemp') || "";
const planIds = ['pln_compte-praticien-offre-speciale-500-premiers--893z0o60', 'pln_praticien-belgique-2p70qka'];
var memberData;
try {
  memberData = JSON.parse(localStorage.getItem('_ms-mem') || '{}');
} catch (e) {
  memberData = {};
}
const activePlanIds = memberData.planConnections?.filter(item => item.status === "ACTIVE" || item.status == "REQUIRES_PAYMENT").map(item => item.planId) || [];
let activeFilter = (getItemWithExpiration('filterTemp'))
    || (
      ((activePlanIds.length === 1 && planIds.includes(activePlanIds[0]))
      || (activePlanIds.length === 2
          && activePlanIds.includes("pln_brique-past-due-os1c808ai")
          && activePlanIds.some(id => planIds.includes(id)))
      )
      ? "medecine-generale"
      : ""
    );

// Adaptive debounce: instant for short queries (1-2 chars) so single-letter
// browsing feels live; small delay for longer queries to coalesce fast typing.
let searchDebounceTimer;
searchBar?.addEventListener("input", (event) => {
  clearTimeout(searchDebounceTimer);
  const len = searchBar.value.trim().length;
  const delay = len <= 2 ? 0 : 150;
  searchDebounceTimer = setTimeout(() => inputEvent(searchBar, event), delay);
});

// ---- Deferred, de-duplicated search-analytics logging ----
// `updateQueryCount` is pure telemetry (a GET + POST to the search-queries ES
// index). It used to fire on EVERY keystroke, producing an N+1 burst per search
// (e.g. "diab", "diabe", "diabet", "diabete") that polluted query counts and
// competed with the result fetch on the same ES host. We never touch the result
// render path; instead we log the FINAL settled query once, ~1s after the user
// stops typing — so the first result still appears instantly.
var loggedQueries = new Set();   // query strings already counted this page-load
var analyticsTimer;
var pendingQueryLog = null;      // { query, results }
var CARRIED_QUERY_KEY = "ot_pending_query_log";
var MAX_CARRIED = 25;            // cap stored batch (defensive: axios-down across many navs)

// Dedup on the bare query string: `count` must increment EXACTLY once per query
// per page-load (it feeds Finder Importance), and updateQueryCount bumps `count`
// whether or not the query had results. Trade-off: a query first seen with no
// results then later returning results in the SAME load keeps its first-seen
// noResults flag — a rare, minor analytics-accuracy edge we accept rather than
// risk double-counting `count` with a state-aware key.

function scheduleQueryLog(query, results) {
  pendingQueryLog = { query: query, results: results };
  clearTimeout(analyticsTimer);
  analyticsTimer = setTimeout(flushQueryLog, 1000);
}

function flushQueryLog() {
  var job = pendingQueryLog;
  pendingQueryLog = null;
  if (!job || loggedQueries.has(job.query)) return;
  loggedQueries.add(job.query);
  // Fire directly (not via requestIdleCallback): it's async network, doesn't
  // block render, and the 1s debounce already keeps it clear of the active
  // result fetch. Deferring further only widens the window where a navigation
  // could drop the count.
  updateQueryCount(job.query, job.results, true);
}

// A search the user commits to — clicks a result, hits back, closes the tab —
// navigates away before the 1s timer fires, and the two-step GET+POST can't
// complete during unload. So on hide we persist the pending query and count it
// on the next page load (or bfcache restore), when the page is alive again.
// Entries are stored as an ARRAY so a still-unreplayed carry from an earlier
// load is never clobbered. `pagehide` covers same-tab result clicks
// (window.location.href); `visibilitychange` covers mobile Safari, which fires
// pagehide/unload unreliably.
function carryPendingToNextLoad() {
  if (!pendingQueryLog || loggedQueries.has(pendingQueryLog.query)) return;
  var entry = pendingQueryLog;
  try {
    var existing = getItemWithExpiration(CARRIED_QUERY_KEY);
    var batch = Array.isArray(existing) ? existing : (existing ? [existing] : []);
    if (!batch.some(function (e) { return e && e.query === entry.query; })) batch.push(entry);
    if (batch.length > MAX_CARRIED) batch = batch.slice(-MAX_CARRIED);
    setItemWithExpiration(CARRIED_QUERY_KEY, batch, 24);
    // Only after the persist SUCCEEDS: mark logged + clear pending. If setItem
    // throws (private mode / quota), leave both intact so the 1s flush timer can
    // still count it on this live page.
    loggedQueries.add(entry.query);
    pendingQueryLog = null;
  } catch (e) { /* storage full / private mode — best-effort */ }
}
window.addEventListener("pagehide", carryPendingToNextLoad);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") carryPendingToNextLoad();
});

// Replay queries carried from a previous page (see carryPendingToNextLoad).
// Claim them against in-page dedup immediately (so a concurrent re-search of the
// same query can't double-count), but wait for axios — loaded async, often not
// ready at module init — and don't consume the stored batch until the writes
// actually fire, so a not-yet-ready page never silently drops them.
function replayCarriedQueryLog(attempt) {
  var carried = getItemWithExpiration(CARRIED_QUERY_KEY);
  if (!carried) return;
  var batch = (Array.isArray(carried) ? carried : [carried]).filter(function (e) { return e && e.query; });
  if (!batch.length) { localStorage.removeItem(CARRIED_QUERY_KEY); return; }
  batch.forEach(function (e) { loggedQueries.add(e.query); });
  if (typeof axios === "undefined") {
    if ((attempt || 0) < 20) {
      setTimeout(function () { replayCarriedQueryLog((attempt || 0) + 1); }, 250);
    }
    return;
  }
  localStorage.removeItem(CARRIED_QUERY_KEY);
  batch.forEach(function (e) { updateQueryCount(e.query, e.results, true); });
}
replayCarriedQueryLog();
window.addEventListener("pageshow", function (e) {
  if (e.persisted) replayCarriedQueryLog(0);   // bfcache restore: module didn't re-init
});

function handleSendResultsToGA(element, query, resultCount) {
   window.dataLayer.push({ event: "show_search_results", element, query: query || "", result_count: resultCount ?? 0 });
}

function handleSendClickResultToGA(element, query, slug, position) {
  window.dataLayer.push({ event: "click_search_results", element, query: query || "", clicked_slug: slug || "", position: position ?? 0 });
}

searchBar?.addEventListener('blur', () => {
   var query = searchBar.value.trim()

   setTimeout(function() {
      if (query.length > 0) {
        updateQueryCount(query, true, false);
        window.dataLayer.push({ event: "search_used", element: searchBar.id, query: query });
      }
  }, 2000)
});

async function clickEvent(activeFilter) {
  const searchBar = searchBarMain || searchBarNav;
  let query = searchBar.value.trim();

  const { results, fromSuggest } = await search(query, activeFilter);

  const searchResults = document.getElementById("search-results");

  if (results.length === 0) {
    let searchResultInner =
      searchResults.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`);

    searchResultInner.innerHTML =
      `Pas de résultats pour "${query}", dans ce module.`;

    return true;
  }

  // Avec la nouvelle signature
  displayResults(results, searchBar, fromSuggest);
}

async function inputEvent(input, e) {
  currentFocus = -1;

  const query = input.value.trim();
  const inputType = e?.inputType; // may be undefined

  // No query: clear results and bail
  if (!query) {
    document.querySelector("#search-results")?.remove();
    return false;
  }

  let results = [];
  let fromSuggest = false;

  try {
    const r = await search(query, activeFilter);
    results = r.results ?? [];
    fromSuggest = r.fromSuggest ?? false;
  } catch (err) {
    console.error("search() failed:", err);
  }

  // No results path
  var isBlocked = BLOCKED_QUERIES.has(normalizeForBlocklist(query));
  if (results.length === 0) {
    const existing = document.getElementById("search-results");

    // If previous results are displayed, keep them visible (better UX than "no results")
    // EXCEPT when the query is explicitly blocked (no matching fiche exists)
    if (!isBlocked && existing && existing.querySelector('#filter')) {
      if (inputType !== "deleteContentBackward" && query.length > 3) {
        scheduleQueryLog(query, false);
      }
      return true;
    }

    // No previous results — show "no results" message
    existing?.remove();

    const searchResults = document.createElement("div");
    searchResults.id = "search-results";

    const inputRect = input.getBoundingClientRect();
    if (window.matchMedia("(min-width: 480px)").matches) {
      searchResults.style.cssText = "box-shadow: 0 0 0 1px rgb(35 38 59 / 10%), 0 6px 16px -4px rgb(35 38 59 / 15%); border-radius: 4px; padding: 16px; background: #fff;";
      searchResults.style.width = input.id === "search-bar-nav" ? `${inputRect.width * 2}px` : `${inputRect.width}px`;
      searchResults.style.left = `${inputRect.left}px`;
    } else {
      searchResults.style.cssText = "width: calc(100% - 1rem); margin-left: .5rem; margin-right: .5rem; padding: 16px; background: #fff;";
    }
    var isMain = input.id === "search-bar-main" || input.id === "search-bar-hp";
    searchResults.style.position = isMain ? "absolute" : "fixed";
    searchResults.style.top = isMain ? `${inputRect.bottom + window.pageYOffset + 5}px` : `${inputRect.bottom + 5}px`;
    searchResults.style.zIndex = isMain ? "9999" : "10000";

    searchResults.innerHTML =
      `Pas de résultats pour "${query}". Vérifiez l'orthographe de votre recherche`;
    document.body.appendChild(searchResults);

    if (inputType !== "deleteContentBackward" && query.length > 3) {
      scheduleQueryLog(query, false);
    }
    return true;
  }

  // We have results — arm telemetry BEFORE painting so a render error can't
  // suppress the count; scheduleQueryLog only sets a timer (no network/DOM work),
  // so this does not delay the first result.
  if (inputType !== "deleteContentBackward" && query.length > 3) {
    scheduleQueryLog(query, true);
  }

  handleSendResultsToGA(input.id, query, results.length);
  displayResults(results, input, fromSuggest);
  return true;
}

searchBar?.addEventListener("focus", async (e) => {
  const isMobile = window.innerWidth < 767;

  const container =
    e?.target?.closest("#search-component, .search-component") ||
    document.getElementById("search-component");

  if (isMobile && container) {
    container.style.scrollMarginTop = "80px";

    const isIOS = /iP(hone|od|ad)/i.test(navigator.userAgent);
    const isSafari = /^(?!.*(chrome|android)).*safari/i.test(navigator.userAgent);

    const doScroll = () => {
      container.scrollIntoView({ behavior: "smooth", block: "start" });
      if (isSafari || isIOS) {
        window.scrollBy(0, 100);
      }
    };

    if (isSafari || isIOS) {
      setTimeout(doScroll, 100);
    } else {
      doScroll();
    }
  }

  const input = e?.target ?? searchBar;
  const query = input?.value?.trim() || "";
  if (!query) return;

  const { results, fromSuggest } = await search(query, activeFilter);

  if (typeof searchBarMain !== "undefined" && searchBarMain) {
    handleSendResultsToGA("search-bar-focus", query, results.length);
  } else {
    handleSendResultsToGA("search-bar-nav-focus", query, results.length);
  }

  if (results.length > 0) {
    displayResults(results, input, fromSuggest);
  }
});



searchBar?.addEventListener("keydown", (e) => {
  if (e.key === 'Enter') {
     e.preventDefault();
 }
  keyDownEvent(e);
});

const searchBtn = document.getElementById("search-btn");

if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    const query = document.getElementById("search-bar-main").value.trim();
    window.location.href = `${baseUrl}/search-result?query=${query}&page=1`;
  });
}

function keyDownEvent(e) {
  var x = document.getElementById("search-results") || (typeof activeTab !== 'undefined' && document.querySelector(`div[data-w-tab="${activeTab}"] div.search-result-body`));
  if (x) {
     x = x.getElementsByTagName("a");
  } else {
     if (e.keyCode == 13) {
        const query = e.currentTarget.value.trim();
        window.location.href = `${baseUrl}/search-result?query=${query}&page=1`;
     }
  }
  if (e.keyCode == 40) {
    if (currentFocus == -1 && !window.location.pathname.includes("search-result")) currentFocus = 3;
    currentFocus++;
    addActive(x);
  } else if (e.keyCode == 38) {
    currentFocus--;
    addActive(x);
  } else if (e.keyCode == 13) {
    e.preventDefault();
    if (currentFocus > -1) {
      if (x) x[currentFocus].click();
    } else {
        const query = e.currentTarget.value.trim();
        window.location.href = `${baseUrl}/search-result?query=${query}&page=1`;
    }
  }
}

function addActive(x) {
  if (!x) return false;
  removeActive(x);
  if (currentFocus >= x.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = x.length - 1;
  x[currentFocus].classList.add("autocomplete-active");
}

function removeActive(x) {
  for (var i = 0; i < x.length; i++) {
    x[i].classList.remove("autocomplete-active");
  }
}

function transformString(input) {
  return input
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function setItemWithExpiration(key, value, expirationInHours = 24) {
  const now = new Date();
  const expirationTime = now.getTime() + expirationInHours * 60 * 60 * 1000;
  const item = { value, expiration: expirationTime };
  localStorage.setItem(key, JSON.stringify(item));
}

function getItemWithExpiration(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;
  let item;
  try {
    item = JSON.parse(itemStr);
  } catch {
    // Self-heal: corrupted or pre-versioned raw-string value would otherwise
    // throw on init and break the entire finder for this user until they
    // manually clear localStorage in DevTools.
    localStorage.removeItem(key);
    return null;
  }
  if (!item || typeof item.expiration !== 'number') {
    localStorage.removeItem(key);
    return null;
  }
  const now = new Date();
  if (now.getTime() > item.expiration) {
    localStorage.removeItem(key);
    return null;
  }
  return item.value;
}

async function search(query, filter, page) {
  try {
    // Block queries with no matching fiche (return empty instead of wrong fuzzy matches)
    if (BLOCKED_QUERIES.has(normalizeForBlocklist(query))) {
      return { results: [], fromSuggest: false };
    }

    const nameFuzziness =  query.length >= 5 ? 2 : query.length >= 4 ? "AUTO" : 0;

    const response = await axios.post(
      `${ES_URL}/_search`,
      {
        query: {
          function_score: {
            query: {
              bool: {
                must: [
                  {
                    bool: {
                      should: [
                        {
                          match_phrase_prefix: {
                            Name: {
                              query: query,
                              slop: 0,
                              max_expansions: 20,
                              boost: 4,
                            },
                          },
                        },
                        {
                          match: {
                            Name: {
                              query: query,
                              operator: "AND",
                              fuzziness: nameFuzziness,
                              boost: 3,
                            },
                          },
                        },
                        {
                          match_phrase_prefix: {
                            Alias: {
                              query: query,
                              slop: 0,
                              max_expansions: 20,
                              boost: 1.5,
                            },
                          },
                        },
                        {
                          match: {
                            Alias: {
                              query: query,
                              operator: "OR",
                              fuzziness: nameFuzziness,
                            },
                          },
                        },
                        {
                          match_phrase_prefix: {
                            Boost: {
                              query: query,
                              slop: 0,
                              max_expansions: 20,
                              boost: 5,
                            },
                          },
                        },
                        {
                          match: {
                            Boost: {
                              query: query,
                              operator: "OR",
                              fuzziness: nameFuzziness,
                              boost: 4,
                            },
                          },
                        },
                        {
                          match: {
                            "Ordonnances médicales": {
                              query: query,
                              operator: "AND",
                              fuzziness: nameFuzziness,
                              boost: 0.5,
                            },
                          },
                        },
                        {
                          match: {
                            "Conseils patient": {
                              query: query,
                              operator: "AND",
                              fuzziness: nameFuzziness,
                              boost: 0.5,
                            },
                          },
                        },
                        {
                          match: {
                            "Informations cliniques - HTML": {
                              query: query,
                              operator: "AND",
                              fuzziness: nameFuzziness,
                              boost: 0.3,
                            },
                          },
                        },
                      ],
                      minimum_should_match: 1,
                    },
                  },
                ],

                filter: filter
                  ? [{ wildcard: { Filtres: `*${filter}*` } }]
                  : [],
                must_not: !filter
                  ? [
                      {
                        bool: {
                          must: [
                            { wildcard: { Filtres: `*only*` } },
                            {
                              bool: {
                                must_not: [{ term: { Filtres: `all-only` } }],
                              },
                            },
                          ],
                        },
                      },
                    ]
                  : [],
              },
            },
            field_value_factor: {
              field: "Importance",
              factor: 1.5,
              modifier: "none",
              missing: 1,
            },
          },
        },
        suggest: {
          med_suggest: {
            prefix: query,
            completion: {
              field: "Slug",
              fuzzy: {
                fuzziness: 2,
              },
              size: 10,
            },
          },
        },
        _source: ["Name", "Slug", "Logo_for_finder_URL", "Wording_Logo", "Filtres"],
        size: page ? 20 : 10,
        from: page ? page * 20 - 20 : 0,
        sort: [
          { _score: { order: "desc" } },
          { Alias: { order: "desc", missing: "_last" } },
          { "Ordonnances médicales": { order: "desc", missing: "_last" } },
          { "Conseils patient": { order: "desc", missing: "_last" } },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "ApiKey SEdpeW1wb0J5bkFkTnVyZVp3TUs6bTFuUDRhdDNRTEdnbWtrSEV4a3QwUQ==",
        },
      }
    );

     const hits = response.data.hits.hits;
   const suggestions = response.data.suggest?.med_suggest?.[0]?.options ?? [];

    const usingSuggestions = hits.length === 0 && suggestions.length > 0;
    const rawResults = usingSuggestions ? suggestions : hits;

    page && displayPagination(response.data.hits.total.value, query);

    const results = rawResults.map((item) => {
      const src = item._source ?? {};
      return {
        Name: src.Name,
        Slug: src.Slug,
        Img: src.Logo_for_finder_URL,
        wordingLogo: src.Wording_Logo,
        filtres: src.Filtres,
      };
    });

    return { results, fromSuggest: usingSuggestions };
  } catch (error) {
    console.error(error);
    return { results: [], fromSuggest: false };
  }
}

// Display the search results
function displayResults(results, input, fromSuggest) {
  let resultList = document.getElementById("search-results");
  let searchResultInner = "";

  if (resultList) {
    var searchResult = resultList.querySelector('#filter');
    if(searchResult){
      searchResultInner = searchResult.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`);
      searchResultInner.innerHTML = "";
    } else {
      resultList.remove();
      resultList = null;
    }
  }

  if (!resultList) {
    resultList = document.createElement("div");
    resultList.id = "search-results";

    const inputRect = input.getBoundingClientRect();

    if (window.matchMedia("(min-width: 480px)").matches) {
      resultList.style.cssText = "box-shadow: 0 0 0 1px rgb(35 38 59 / 10%), 0 6px 16px -4px rgb(35 38 59 / 15%); border-radius: 4px; padding: 8px; background: #fff;";
      if (input.id === "search-bar-nav") {
        resultList.style.width = `${inputRect.width * 2}px`;
        resultList.style.left = `${inputRect.left}px`;
      } else {
        resultList.style.width = `${inputRect.width}px`;
        resultList.style.left = `${inputRect.left}px`;
      }
    } else {
      resultList.style.width = `calc(100% - 1rem)`;
      resultList.style.marginLeft = '.5rem';
      resultList.style.marginRight = '.5rem';
    }
    resultList.style.position = (input.id == "search-bar-main" || input.id == "search-bar-hp") ? "absolute" : "fixed";
    resultList.style.top =
      (input.id == "search-bar-main" || input.id == "search-bar-hp")
        ? `${inputRect.bottom + window.pageYOffset + 5}px`
        : `${inputRect.bottom + 5}px`;
    resultList.style.zIndex = (input.id == "search-bar-main" || input.id == "search-bar-hp") ? "9999" : "10000";
    resultList.style.background = "white";

    let searchResultOriginal = searchBarMain ? document.querySelector('#search-result') : document.querySelector('#search-result-nav');
    if (!searchResultOriginal) return;
    var searchResult = searchResultOriginal.cloneNode(true);
    searchResult.id = "filter";
    searchResult.style.display = "block";
    if(!searchBarMain){
        const scrollContainer = searchResult.querySelector('.search-result-tabs');
        const scrollContent = searchResult.querySelector('.srt-menu');

        scrollContent.addEventListener('mousemove', (e) => {
            const containerWidth = scrollContainer.offsetWidth;
            const contentWidth = scrollContent.scrollWidth;
            const mouseX = e.clientX - scrollContainer.getBoundingClientRect().left;
            const scrollPercentage = mouseX / containerWidth;
            const scrollPosition = (contentWidth - containerWidth) * scrollPercentage;
            scrollContent.style.transform = `translateX(${-scrollPosition}px)`;
        });
    }
    searchResultInner = searchResult.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`)
    searchResult.querySelectorAll('a').forEach((link, index) => {
      if (activeFilter) {
        if (index === 0) link.classList.remove('w--current');
        if (activeFilter == transformString(link.innerText)) {
            link.classList.add('w--current');
            lastActiveTab = link.getAttribute('data-w-tab');
        }
      }
      link.addEventListener('click', (el) => {
          el.preventDefault();
          stringifiedFilter = transformString(el.target.innerText);
          activeFilter = el.target.innerText != "Tous les résultats" ? stringifiedFilter : "";
          setItemWithExpiration('filterTemp', activeFilter, 24);
          document.querySelector('#filter a[data-w-tab="'+lastActiveTab+'"]').classList.remove('w--current');
          el.currentTarget.classList.add('w--current')
          lastActiveTab = el.currentTarget.getAttribute('data-w-tab');
          clickEvent(activeFilter);
      })
    })

    resultList.appendChild(searchResult);
    document.querySelector("body").appendChild(resultList);
  }

  if (fromSuggest && searchResultInner && typeof searchResultInner.appendChild === 'function') {
    const info = document.createElement("div");
    info.textContent = `0 résultats trouvés pour "${input.value}". Voici quelques suggestions :`;
    info.style.padding = "4px 8px";
    info.style.fontSize = "13px";
    info.style.color = "#555";
    info.style.marginBottom = "4px";
    searchResultInner.appendChild(info);
  }


  if (!searchResultInner || typeof searchResultInner.appendChild !== 'function') return;

  results.forEach((result, index) => {
    if (result.filtres && result.filtres.includes("only")){
      let filter;
      if (activeFilter == "") {
        filter = "all";
      } else {
        filter = transformString(activeFilter);
      }
      if (!result.filtres.includes(filter)) return;
    }
    const resultElement = document.createElement("a");

    const img = document.createElement("img");
    img.style.minWidth = "20px";
    img.style.height = "20px";

    resultElement.classList.add("search-result");
    const div =  document.createElement('div');

    img.setAttribute("src", result.Img);
    div.style.cssText = "display: flex; align-items: center; padding: 4px; color: #0c0e16; font-size: 14px;border-radius:4px;white-space: nowrap;";
    div.style.backgroundColor = "transparent";

    if (window.matchMedia("(min-width: 480px)").matches && input.id != "search-bar-nav"){
      div.appendChild(document.createTextNode(result.wordingLogo));
      img.style.marginLeft = "5px";
      div.style.padding = "2px 8px";
    }
    div.appendChild(img);

    resultElement.style.cssText =
      "text-decoration: none; color: #0c0e16; padding: 8px 8px; display: flex; align-items: center; justify-content:space-between; font-size: 14px; border-radius: 4px;";

    resultElement.addEventListener("click", function(event) {
      event.preventDefault();
      handleSendClickResultToGA(input.id, input.value || "", result.Slug, index + 1);
      window.location.href = `${baseUrl}/pathologies/${result.Slug}`;
    });

    resultElement.href = `${baseUrl}/pathologies/${result.Slug}`;
    resultElement.onmouseover = function () { this.style.background = "rgb(240,243,255)"; };
    resultElement.onmouseout  = function () { this.style.background = "none"; };

    resultElement.appendChild(document.createTextNode(result.Name));
    resultElement.appendChild(div);

    searchResultInner.appendChild(resultElement);
  });
}

// -------- Update query counts (Tunisia removed) --------
async function updateQueryCount(query, results = true, click = true) {
  try {
    const currentHost = window.location.hostname;

    // Only log production; ignore staging/sandbox
    let indexName = "";
    if (currentHost.includes("ordotype.fr")) {
      indexName = "search-queries";
    } else if (
      currentHost.includes("sandbox-ordotype.webflow.io") ||
      currentHost.includes("ordotype.webflow.io")
    ) {
      console.log("Aucune action requise pour l'environnement de staging/sandbox.");
      return;
    } else {
      console.error("Domaine non reconnu, aucune action effectuée.");
      return;
    }

    const searchUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/${indexName}/_search?q=query:${encodeURIComponent(query)}`;
    const searchHeaders = {
      "Content-Type": "application/json",
      Authorization:
        "ApiKey SVdpX21wb0J5bkFkTnVyZTJ3TWQ6RkExR1VIXzdTMG1lN0lURUdYVHBfQQ==",
    };
    const response = await axios.get(searchUrl, { headers: searchHeaders });
    const hits = response.data.hits.total.value;

    if (hits > 0) {
      let hit = response.data.hits.hits[0];
      const queryId = hit._id;
      const updateUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/${indexName}/_update/${queryId}`;
      let updateData = {};

      var now = new Date().toISOString();

      if (!click) {
        if (hit._source.hasOwnProperty('noClick')) {
          updateData = {
            script: { source: "ctx._source.noClick += params.count; ctx._source.lastUpdated = params.now", params: { count: 1, now: now } }
          };
        } else {
          updateData = {
            script: { source: "ctx._source.noClick = params.count; ctx._source.lastUpdated = params.now", params: { count: 1, now: now } }
          };
        }
      } else {
        updateData = {
          script: { source: "ctx._source.count += params.count; ctx._source.lastUpdated = params.now", params: { count: 1, now: now } }
        };
        if (!results) {
          if (hit._source.hasOwnProperty('noResults')) {
            updateData.script.source += "; ctx._source.noResults += 1";
          } else {
            updateData.script.source += "; ctx._source.noResults = 1";
          }
        }
      }

      await axios.post(updateUrl, updateData, { headers: searchHeaders });
    } else {
      const indexUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/${indexName}/_doc`;
      var nowNew = new Date().toISOString();
      const indexData = { query, count: 1, createdAt: nowNew, lastUpdated: nowNew };
      if (!results) indexData.noResults = 1;
      await axios.post(indexUrl, indexData, { headers: searchHeaders });
    }
  } catch (error) {
    console.error(`Error updating query count: ${error.message}`);
  }
}
