// ---------- Config ----------
const ES_BASE_URL = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";
// Index name MUST start with `ordotype-index-20` (date): the public search key
// (SEARCH_HEADERS) can read only `ordotype-index-20*`, any other name gets a 403.
// Alias Elastic (et non un index daté) : changer d'index = un appel _aliases atomique, sans
// toucher au JS ni republier le pied de page. Son nom commence lui aussi par
// `ordotype-index-20`, sinon la clé publique est refusée (403). Il pointe sur
// ordotype-index-2026-10-22 (copie du live + champs « début de mot » de buildSearchBody).
const ES_INDEX_STAGING = "ordotype-index-2026-live";
const ES_INDEX_PRODUCTION = "ordotype-index-2026-live";

// Choose index by environment: staging (webflow) vs production
const IS_STAGING = window.location.hostname.includes("ordotype.webflow.io");
const ES_INDEX = IS_STAGING ? ES_INDEX_STAGING : ES_INDEX_PRODUCTION;

// Final Elasticsearch URL
const ES_URL = `${ES_BASE_URL}${ES_INDEX}`;

const baseUrl = window.location.origin;

// Résultats par page sur /search-result (requête Elastic et pagination).
var RESULTS_PAGE_SIZE = 20;

// -1 = aucun résultat surligné (valeur de départ, même si le champ est déjà rempli).
var currentFocus = -1;

// Numéro de la dernière recherche lancée depuis un champ : une réponse plus ancienne
// arrivée après coup est ignorée (sinon elle repeignait d'anciens résultats, ou
// rouvrait la liste sur un champ vidé).
var searchSeq = 0;

// Page de résultats, requête encodée : « & », « # », « % » ne coupent plus la
// recherche (« HTA & grossesse » arrivait en « HTA »).
function searchResultUrl(query) {
  return `${baseUrl}/search-result?query=${encodeURIComponent(query)}&page=1`;
}

// Les champs de recherche (#search-bar-main, #search-bar-nav) sont de vrais
// formulaires Webflow sans bouton d'envoi : toute touche Entrée que le moteur
// n'intercepte pas (champ non branché, saisie en cours de composition sur un
// clavier de téléphone, moteur qui n'a pas fini de démarrer) envoyait le
// formulaire à Webflow au lieu de chercher, et Webflow masquait le champ. Tout envoi
// d'un de ces formulaires devient une recherche. Écouté en capture sur document,
// avant le gestionnaire de Webflow ; posé en tête de fichier, avant tout ce qui
// peut échouer au démarrage (stockage refusé).
document.addEventListener("submit", (e) => {
  const form = e.target;
  const field = form && form.querySelector && form.querySelector("#search-bar-main, #search-bar-nav");
  if (!field) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const query = field.value.trim();
  if (query) window.location.href = searchResultUrl(query);
}, true);

// Blocklist: queries with no matching fiche — return empty results
// instead of misleading fuzzy matches. Remove a term when its fiche is created.
// See: https://www.notion.so/ordotype/32f30a1b750f81a0ab35fdcdc6b4a910
// NOTE: matching is exact on the normalized query, so a blocked WORD does not block
// its prefixes: each prefix that would otherwise fall through to a junk fuzzy match
// needs its own entry (see "hypon" and "pied mai" below).
var BLOCKED_QUERIES = new Set([
  "lupus", "hyponatremie", "tuberculose", "tdah", "gingivite",
  "meningite", "cushing", "pericardite", "horton", "souffle",
  "pied main", "pied-main", "pied main bouche", "pied-main-bouche", "pied-main bouche", "syndrome pied main bouche", "syndrome pied-main-bouche",
  // "pied mai" (20.6k searches) is the one unblocked prefix of "pied main bouche" that
  // still returned a wrong fiche (Dermatophytose ungueale). Shorter prefixes "pied m" /
  // "pied ma" are left unblocked on purpose: negligible volume, and they are plausible
  // prefixes of "pied mycose", for which Dermatophytose ungueale is a good answer.
  "pied mai", "pied-mai",
  // "hypon" (10.3k searches, 9.3% no-click) fuzzy-matched Hyperthyroidie (hypon~hyper).
  // The hyponatremie fiche exists but is kept out of the Finder (owner's decision,
  // 2026-10-20): remove this whole chain the day it is added.
  "hypon",
  "anti",
  // 2026-10-22: prefixes of the blocked terms above that still showed an unrelated fiche
  // (fuzzy hit or slug suggestion) although 85-99% of the people typing them go on to the
  // blocked word. Same rule as "hypon": block the prefix, not only the word.
  "hypona", "hyponat", "hyponatr",   // hyponatremie (showed Hypocalcemie / Hypokaliemie)
  "lupu",                            // lupus (Lucite, Leucorrhees)
  "tube", "tuber",                   // tuberculose (Thrombopenie, NCB)
  "cush",                            // cushing (Cassure staturo-ponderale)
  "peric", "perica",                 // pericardite (Douleurs de fesse)
  "hort", "horto",                   // horton (Hypothyroidie)
  "souf", "souff",                   // souffle (Implant contraceptif)
  "hyperac", "hyperact", "hyperactivite"  // hyperactivite = TDAH, blocked (Hyperthyroidie, Enuresie)
]);

function normalizeForBlocklist(q) {
  return q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Pinned #1 for a few ultra-short, ambiguous high-traffic prefixes where the most
// common condition is the near-certain intent. Under the compressed (sqrt) Importance
// model a rarer same-prefix fiche can edge ahead (e.g. "Hype" -> Hyperthyro\u00efdie instead
// of the far more common Hypertension); pin the canonical fiche (by slug) to #1 for
// these exact normalized queries. No-op when that fiche is already #1.
// Une valeur peut être une liste : la première fiche présente dans les résultats passe en
// tête (ex. la fiche d'orientation sans filtre, sa jumelle sous le filtre médecine générale).
var PINNED_FIRST = {
  "h": "hta",      // Hypertension art\u00e9rielle
  "hy": "hta",
  "hyp": "hta",
  "hype": "hta",
  // 2026-10-22 intent audit: prefixes where the fiche most users go on to sits at #2
  // behind a higher-Importance fiche that Alias/Boost could not overtake.
  "coli": "colique-nephretique",          // 91% go on to "colique" (was Diarrhee aigue)
  "pruri": "prurit",                      // 97% prurit (was Urticaire chronique)
  "epis": "epistaxis",                    // 78% epistaxis (was Episode depressif)
  "gastrit": "gastrite",                  // was Ulcere gastro-duodenal
  "appe": "suspicion-dappendicite",       // appendicite (was Fievre sans point d'appel)
  "rhiz": "arthrose-digitale-orientation",  // rhizarthrose (was Pseudopolyarthrite rhizomelique)
  "mater": "prescription-de-materiel-medical",  // materiel (was Grossesse)
  "suivi": "grossesse-a-bas-risque-examens-systematiques",  // suivi de grossesse >> bariatrique
  // 22/10, revue de la requête « début de mot » (buildSearchBody) : préfixes où elle changeait
  // la 1re fiche à tort, d'après ce que les médecins tapent ensuite, leurs clics et une relecture
  // médicale. Presque tous remettent la réponse d'avant ; les autres suivent la relecture
  // (stérilet, abcès superficiel, constipation, leucorrhées).
  "resp": "dyspnee-sans-signe-dorientation", "respi": "dyspnee-sans-signe-dorientation", "respir": "dyspnee-sans-signe-dorientation", "respira": "dyspnee-sans-signe-dorientation", "respirat": "dyspnee-sans-signe-dorientation", "respiratoi": "dyspnee-sans-signe-dorientation",
  "respiratoir": "dyspnee-sans-signe-dorientation", "respiratoire": "dyspnee-sans-signe-dorientation",
  "anxiet": "troubles-anxieux", "anxiete": "troubles-anxieux", "cr": "troubles-anxieux", "trou": "troubles-anxieux", "troub": "troubles-anxieux", "troubl": "troubles-anxieux",
  "tens": "hta", "tensi": "hta", "tensio": "hta", "tension": "hta", "tensionn": "hta",
  "chole\"": "dyslipidemie", "st": "dyslipidemie", "stat": "dyslipidemie", "stati": "dyslipidemie",
  "somm": "troubles-sommeil", "somme": "troubles-sommeil", "sommei": "troubles-sommeil", "sommeil": "troubles-sommeil",
  "ster": "contraception-par-dispositif-intra-uterin-diu-gynecologie", "steri": "contraception-par-dispositif-intra-uterin-diu-gynecologie", "steril": "contraception-par-dispositif-intra-uterin-diu-gynecologie",
  "epaue": "douleur-de-l-epaule", "epauk": "douleur-de-l-epaule", "tendi": "douleur-de-l-epaule",
  "lombag": "lombalgies-orientation", "lombairer": "lombalgies-orientation", "travail": "lombalgies-orientation",
  "meta": "metatarsalgies-orientation-diagnostique", "metat": "metatarsalgies-orientation-diagnostique", "metata": "metatarsalgies-orientation-diagnostique",
  "vertg": "vertiges", "vertgi": "vertiges", "vertiges": "vertiges",
  "langue": "candidose", "mucose": "candidose",
  "pillu": "contraception-par-pilule-oestroprogestative-gynecologie", "pillul": "contraception-par-pilule-oestroprogestative-gynecologie",
  "eczeam": "dermatite-atopique", "exzema": "dermatite-atopique",
  "dermi": "dermatite-seborrheique", "dermit": "dermatite-seborrheique",
  "infectionurinaire femme": "infections-urinaires", "iu masculin": "infections-urinaires",
  "psoa": "psoriasis", "psora": "psoriasis",
  "attelle": "syndrome-du-canal-carpien", "ca": "syndrome-du-canal-carpien",
  "q": "tenosynovite-de-de-quervain", "qu": "tenosynovite-de-de-quervain",
  "abces": "abces-superficiel",
  "acco": "acouphenes",
  "ad": "adenopathie",
  "angie": "angine-2",
  "bili": "anomalie-du-bilan-hepatique",
  "surrenale": "asthenie",
  "band": "bandelette-urinaire",
  "collyre": "conjonctivite",
  "transit": "constipation",
  "nou": "dermatite-atopique-du-nourrisson",
  "dysmenorrhee": "dysmenorrhee",
  "ten": "epicondylite",
  "dema": "gale",
  "suiv": "grossesse-a-bas-risque-examens-systematiques",
  "hypery": "hyperthyroidie",
  "thyr": "hypothyroidie",
  "doxy": "infections-sexuellement-transmissibles-ist-mst",
  "vagins": "leucorrhees",
  "sa": "lithiases-salivaires",
  "lombai": "lombalgies",
  "fond": "migraines",
  "mo": "mononucleose-infectieuse",
  "ungueal": "onychomycose",
  "perforation": "otite-moyenne-aigue-de-lenfant",
  "sere": "otite-seromuqueuse",
  "gi": "primo-infection-herpetique",
  "rose": "pytiriasis-rose-de-gilbert",
  "pieds": "soins-pied-diabetique",
  "cou": "suites-de-couches",
  "hemostase": "syndromes-hemorragiques",
  "cra": "urgences-documents-utiles",
  "dosage": "vitamine-d",
  // 30/10, première mesure après la mise en ligne du 23/10 : préfixes où la 1re fiche avait
  // changé alors que les médecins cliquaient une autre fiche de la liste (clics par position).
  "thyroi": "hypothyroidie", "thyroid": "hypothyroidie",
  "hp": "h-pylori", "hpv": "depistage-cancer-du-col-de-luterus",
  "stomatite": "candidose",
  "fol": "carence-en-vitamine-b9",
  "tend": "douleur-de-l-epaule", "tendin": "douleur-de-l-epaule",
  "tendino": "tendinopathie-de-la-coiffe-des-rotateurs-orientation",
  // La fiche prostatite n'est pas encore dans le Finder : à revoir le jour où elle y entre.
  "prostat": "infections-urinaires", "prostati": "infections-urinaires",
  "ferr": "hyperferritinemie", "ferri": "hyperferritinemie", "ferriti": "hyperferritinemie", "ferritine": "hyperferritinemie",
  "steatose": "anomalie-du-bilan-hepatique",
  "c": ["conjonctivite", "syndrome-du-canal-carpien"],
  "osteoporose": ["osteoporose-orientation", "osteoporose"],
};

// Handle click outside of search results
document.addEventListener("click", ({ target }) => {
  // Un clic dans le champ actif ne ferme pas la liste : sans nouveau focus, rien ne
  // la rouvrait avant la frappe suivante. Champ = toute sa zone (zone grise et loupe
  // du panneau mobile, formulaire de la barre), sauf les boutons d'effacement.
  if (searchBar) {
    var zone = searchBar.closest(".search-panel_field, .ot-search-field") || searchBar.form || searchBar;
    if (zone.contains(target) && !(target.closest && target.closest("button, [type='reset']"))) return;
  }
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
  memberData = JSON.parse(localStorage.getItem('_ms-mem') || '{}') || {};
} catch (e) {
  memberData = {};
}
// Syntaxe ES2019 seulement dans ce fichier (pas de « ?. » ni de « ?? ») : navigateurs
// anciens. Vérifié par check-parse-floor.sh.
const activePlanIds = (memberData.planConnections || []).filter(item => item.status === "ACTIVE" || item.status == "REQUIRES_PAYMENT").map(item => item.planId);
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
if (searchBar) searchBar.addEventListener("input", (event) => {
  clearTimeout(searchDebounceTimer);
  const len = searchBar.value.trim().length;
  const delay = len <= 2 ? 0 : 150;
  searchDebounceTimer = setTimeout(() => inputEvent(searchBar, event), delay);
});

// ---- Deferred, de-duplicated search-analytics logging ----
// `updateQueryCount` is pure telemetry (one POST _update to the search-queries ES
// index). It used to fire on EVERY keystroke, producing an N+1 burst per search
// (e.g. "diab", "diabe", "diabet", "diabete") that polluted query counts and
// competed with the result fetch on the same ES host. We never touch the result
// render path; instead we log the FINAL settled query once, ~1s after the user
// stops typing — so the first result still appears instantly.
var loggedQueries = new Set();   // keys (queryKey) already counted this page-load
var analyticsTimer;
var pendingQueryLog = null;      // { query, results }
var CARRIED_QUERY_KEY = "ot_pending_query_log";
// Minimal JSON transport. Returns { data }, the shape every call site here
// already expects, and throws on a non-2xx status so the existing catch blocks
// behave exactly as before. The thrown message carries no URL: the search URL
// holds the visitor's own query.
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
  return { data: await res.json() };
}

// Public by design (it ships to every browser): read-only key limited to the
// Finder indexes, whose names must start with `ordotype-index-20`.
const SEARCH_HEADERS = {
  "Content-Type": "application/json",
  Authorization:
    "ApiKey S1p5d0c2RUJ6bmczS0FNZFFuZE06SGY5bVZsRGdTby13QWR5Q2VINzVzZw==",
};

var MAX_CARRIED = 25;            // cap stored batch (defensive: writes failing across many navs)

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
  if (!job || loggedQueries.has(queryKey(job.query))) return;
  loggedQueries.add(queryKey(job.query));
  // Fire directly (not via requestIdleCallback): it's async network, doesn't
  // block render, and the 1s debounce already keeps it clear of the active
  // result fetch. Deferring further only widens the window where a navigation
  // could drop the count.
  updateQueryCount(job.query, job.results, true);
}

// A search the user commits to — clicks a result, hits back, closes the tab —
// navigates away before the 1s timer fires, and the async SHA-1 + POST can't
// complete during unload. So on hide we persist the pending query and count it
// on the next page load (or bfcache restore), when the page is alive again.
// Entries are stored as an ARRAY so a still-unreplayed carry from an earlier
// load is never clobbered. `pagehide` covers same-tab result clicks
// (window.location.href); `visibilitychange` covers mobile Safari, which fires
// pagehide/unload unreliably.
function carryPendingToNextLoad() {
  if (!pendingQueryLog || loggedQueries.has(queryKey(pendingQueryLog.query))) return;
  var entry = pendingQueryLog;
  try {
    var existing = getItemWithExpiration(CARRIED_QUERY_KEY);
    var batch = Array.isArray(existing) ? existing : (existing ? [existing] : []);
    if (!batch.some(function (e) { return e && queryKey(e.query) === queryKey(entry.query); })) batch.push(entry);
    if (batch.length > MAX_CARRIED) batch = batch.slice(-MAX_CARRIED);
    setItemWithExpiration(CARRIED_QUERY_KEY, batch, 24);
    // Only after the persist SUCCEEDS: mark logged + clear pending. If setItem
    // throws (private mode / quota), leave both intact so the 1s flush timer can
    // still count it on this live page.
    loggedQueries.add(queryKey(entry.query));
    pendingQueryLog = null;
  } catch (e) { /* storage full / private mode — best-effort */ }
}
window.addEventListener("pagehide", carryPendingToNextLoad);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") carryPendingToNextLoad();
});

// Replay queries carried from a previous page (see carryPendingToNextLoad).
// Claim them against in-page dedup immediately, so a concurrent re-search of the
// same query cannot double-count.
function replayCarriedQueryLog() {
  var carried = getItemWithExpiration(CARRIED_QUERY_KEY);
  if (!carried) return;
  var batch = (Array.isArray(carried) ? carried : [carried]).filter(function (e) { return e && e.query; });
  if (!batch.length) { removeStored(CARRIED_QUERY_KEY); return; }
  batch.forEach(function (e) { loggedQueries.add(queryKey(e.query)); });
  removeStored(CARRIED_QUERY_KEY);
  batch.forEach(function (e) { updateQueryCount(e.query, e.results, true); });
}
replayCarriedQueryLog();
window.addEventListener("pageshow", function (e) {
  if (e.persisted) replayCarriedQueryLog();   // bfcache restore: module didn't re-init
});

// dataLayer créé s'il manque (GTM bloqué avant son extrait) : un push qui lève
// arrêterait l'affichage ou le clic qui le suit.
function pushDataLayer(evt) {
  (window.dataLayer = window.dataLayer || []).push(evt);
}

function handleSendResultsToGA(element, query, resultCount) {
   pushDataLayer({ event: "show_search_results", element, query: query || "", result_count: resultCount == null ? 0 : resultCount });
}

function handleSendClickResultToGA(element, query, slug, position) {
  pushDataLayer({ event: "click_search_results", element, query: query || "", clicked_slug: slug || "", position: position == null ? 0 : position });
}

// Valeur posée par la page et pas encore retouchée : la requête de /search-result
// reprise de l'adresse (attribut data-prefill, retiré à la première frappe). Ce n'est
// pas une nouvelle recherche : ni comptée, ni envoyée à GA au focus ou à la sortie du
// champ. Pas defaultValue : le bouton « Effacer » est un type="reset", qui remettrait
// alors la requête au lieu de vider le champ.
function isPrefilled(input) {
  return !!input && input.value !== "" && input.getAttribute("data-prefill") === input.value;
}

var noClickLogged = new Set();   // noClick compté une fois par requête et par page
if (searchBar) searchBar.addEventListener('blur', () => {
   var query = searchBar.value.trim()
   if (isPrefilled(searchBar)) return;

   setTimeout(function() {
      if (query.length > 0) {
        if (!noClickLogged.has(queryKey(query))) {
          noClickLogged.add(queryKey(query));
          updateQueryCount(query, true, false);
        }
        pushDataLayer({ event: "search_used", element: searchBar.id, query: query });
      }
  }, 2000)
});

async function clickEvent(activeFilter) {
  if (!searchBar) return;
  let query = searchBar.value.trim();
  var seq = ++searchSeq;

  const { results, fromSuggest } = await search(query, activeFilter);
  // Dépassée par une recherche plus récente, ou par une frappe encore dans son délai.
  if (seq !== searchSeq || searchBar.value.trim() !== query) return;

  // La liste a pu être fermée pendant la recherche.
  const searchResults = document.getElementById("search-results");
  if (!searchResults) return;

  if (results.length === 0) {
    let searchResultInner =
      searchResults.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`);

    // textContent, jamais innerHTML : la requête est du texte tapé, pas du HTML.
    if (searchResultInner) {
      searchResultInner.textContent = "";
      var msg = document.createElement("div");
      msg.textContent = `Pas de résultats pour "${query}", dans ce module.`;
      // Téléphone, champ principal : la liste n'a pas de marge intérieure, le texte
      // s'aligne sur celui des lignes.
      if (mainFieldFrame(searchBar)) msg.style.padding = "12px";
      searchResultInner.appendChild(msg);
    }

    return true;
  }

  // Avec la nouvelle signature
  displayResults(results, searchBar, fromSuggest);
}

async function inputEvent(input, e) {
  currentFocus = -1;

  const query = input.value.trim();
  const inputType = e && e.inputType; // may be undefined

  // No query: clear results and bail
  if (!query) {
    searchSeq++;
    var open = document.querySelector("#search-results");
    if (open) open.remove();
    return false;
  }

  let results = [];
  let fromSuggest = false;
  var seq = ++searchSeq;

  try {
    const r = await search(query, activeFilter);
    results = r.results || [];
    fromSuggest = !!r.fromSuggest;
  } catch (err) {
    console.error("search() failed:", err);
  }

  // Une frappe plus récente a relancé une recherche : cette réponse est dépassée.
  if (input.value.trim() !== query) return false;
  if (seq !== searchSeq) {
    // Même texte, mais un onglet de filtre ou le focus a relancé la recherche : on ne
    // repeint pas (elle affichera sa réponse), la requête tapée reste comptée.
    if (inputType !== "deleteContentBackward" && query.length > 3) scheduleQueryLog(query, results.length > 0);
    return false;
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
    if (existing) existing.remove();

    const searchResults = document.createElement("div");
    searchResults.id = "search-results";

    const inputRect = input.getBoundingClientRect();
    const mainFrame = mainFieldFrame(input);
    if (window.matchMedia("(min-width: 480px)").matches) {
      searchResults.style.cssText = "box-shadow: 0 0 0 1px rgb(35 38 59 / 10%), 0 6px 16px -4px rgb(35 38 59 / 15%); border-radius: 4px; padding: 16px; background: #fff;";
      searchResults.style.width = input.id === "search-bar-nav" ? `${inputRect.width * 2}px` : `${inputRect.width}px`;
      searchResults.style.left = `${inputRect.left}px`;
    } else if (mainFrame) {
      searchResults.style.cssText = MAIN_LIST_FRAME + " padding: 16px; background: #fff;";
    } else {
      searchResults.style.cssText = "width: calc(100% - 1rem); margin-left: .5rem; margin-right: .5rem; padding: 16px; background: #fff;";
    }
    var isMain = input.id === "search-bar-main" || input.id === "search-bar-hp";
    searchResults.style.position = isMain ? "absolute" : "fixed";
    searchResults.style.top = isMain ? `${inputRect.bottom + window.pageYOffset + 5}px` : `${inputRect.bottom + 5}px`;
    searchResults.style.zIndex = isMain ? "9999" : "10000";
    if (mainFrame) placeUnderMainField(searchResults, mainFrame);

    // textContent, jamais innerHTML : la requête est du texte tapé, pas du HTML.
    searchResults.textContent =
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

if (searchBar) searchBar.addEventListener("focus", async (e) => {
  const isMobile = window.innerWidth < 767;

  var target = e && e.target;
  const container =
    (target && target.closest && target.closest("#search-component, .search-component")) ||
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

  const input = target || searchBar;
  const query = ((input && input.value) || "").trim();
  if (!query || isPrefilled(input)) return;

  var seq = ++searchSeq;
  const { results, fromSuggest } = await search(query, activeFilter);
  if (seq !== searchSeq || input.value.trim() !== query) return;

  if (typeof searchBarMain !== "undefined" && searchBarMain) {
    handleSendResultsToGA("search-bar-focus", query, results.length);
  } else {
    handleSendResultsToGA("search-bar-nav-focus", query, results.length);
  }

  if (results.length > 0) {
    displayResults(results, input, fromSuggest);
  }
});



if (searchBar) searchBar.addEventListener("keydown", (e) => {
  if (e.key === 'Enter') {
     e.preventDefault();
 }
  keyDownEvent(e);
});

const searchBtn = document.getElementById("search-btn");

if (searchBtn) {
  searchBtn.addEventListener('click', (e) => {
    e.preventDefault(); // lien « # » : pas d'ancre ajoutée à l'adresse avant de partir
    const query = document.getElementById("search-bar-main").value.trim();
    window.location.href = searchResultUrl(query);
  });
}

// Flèches haut/bas : seulement entre les résultats (a.search-result), plus entre les
// onglets de filtre. L'ancien départ « currentFocus = 3 » sautait en dur les 4 onglets
// d'aujourd'hui : un onglet ajouté dans le Designer décalait toute la navigation.
function keyDownEvent(e) {
  var box = document.getElementById("search-results") || (typeof activeTab !== 'undefined' && document.querySelector(`div[data-w-tab="${activeTab}"] div.search-result-body`));
  var x = box ? box.querySelectorAll("a.search-result") : null;
  if (e.keyCode == 40) {
    currentFocus++;
    addActive(x);
  } else if (e.keyCode == 38) {
    currentFocus--;
    addActive(x);
  } else if (e.keyCode == 13) {
    e.preventDefault();
    if (x && x[currentFocus]) {
      x[currentFocus].click();
    } else {
      const query = e.currentTarget.value.trim();
      if (query) window.location.href = searchResultUrl(query);
    }
  }
}

function addActive(x) {
  if (!x || !x.length) return false;
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

// Stockage refusé (cookies bloqués : « The operation is insecure », WebView
// sans localStorage) : la lecture rend null au lieu de lever, sinon le moteur
// s'arrêtait au démarrage, sans résultats ni Entrée.
function removeStored(key) {
  try { localStorage.removeItem(key); } catch (e) { /* stockage refusé */ }
}

function getItemWithExpiration(key) {
  let itemStr;
  try {
    itemStr = localStorage.getItem(key);
  } catch (e) {
    return null;
  }
  if (!itemStr) return null;
  let item;
  try {
    item = JSON.parse(itemStr);
  } catch {
    // Self-heal: corrupted or pre-versioned raw-string value would otherwise
    // throw on init and break the entire finder for this user until they
    // manually clear localStorage in DevTools.
    removeStored(key);
    return null;
  }
  if (!item || typeof item.expiration !== 'number') {
    removeStored(key);
    return null;
  }
  const now = new Date();
  if (now.getTime() > item.expiration) {
    removeStored(key);
    return null;
  }
  return item.value;
}

// ---- corps de la requête (miroir : webflow-scripts/webflow/finder_v2/v2_query.py, profil H3keep+H7) ----
// Fonction pure : le banc de mesure l'exécute dans node et vérifie qu'elle envoie la requête mesurée.
//
// Par rapport à la requête du 07/04 (mesuré le 22/10 contre le live : plus de recherches à la
// bonne fiche, aucune régression sur les requêtes fréquentes) :
// - « début de mot » (H3keep) : chaque mot tapé doit commencer un mot de Name / Alias / Boost
//   (sous-champs .ledge / .sedge, n-grammes de début de mot). Ajouté AVANT la clause phrase de
//   chaque champ, qui reste : l'ordre des mots tapés n'a plus à être celui de la fiche, et le
//   préfixe n'est plus limité aux 20 premiers termes du dictionnaire (max_expansions).
// - Importance (H7) : (1,5 x Importance)^e au lieu de sqrt, avec e = 0,5 (= sqrt, inchangé)
//   jusqu'à 3 caractères et 0,25 à partir de 4. Sur les premières lettres le texte ne départage
//   pas, l'Importance garde son poids ; ensuite elle n'écrase plus une fiche mieux ciblée.
// Inchangé : flou 0 sur Boost et le corps (bruit « genou » -> Ménopause), prefix_length 1 sur le
// flou de Name / Alias (« otalgie » -> Gonalgie), filtre Filtres, suggestions sur le slug, tri.
function buildSearchBody(query, filter, page) {
  var nameFuzziness = query.length >= 5 ? 2 : query.length >= 4 ? "AUTO" : 0;

  function prefixClauses(field, edgeField, boost) {
    var edge = {}, phrase = {};
    edge[edgeField] = { query: query, operator: "AND", boost: boost };
    phrase[field] = { query: query, slop: 0, max_expansions: 20, boost: boost };
    return [{ match: edge }, { match_phrase_prefix: phrase }];
  }

  var should = []
    .concat(prefixClauses("Name", "Name.ledge", 4))
    .concat([{ match: { Name: { query: query, operator: "AND", fuzziness: nameFuzziness, prefix_length: 1, boost: 3 } } }])
    .concat(prefixClauses("Alias", "Alias.ledge", 1.5))
    .concat([{ match: { Alias: { query: query, operator: "OR", fuzziness: nameFuzziness, prefix_length: 1 } } }])
    .concat(prefixClauses("Boost", "Boost.sedge", 5))
    .concat([
      { match: { Boost: { query: query, operator: "OR", fuzziness: 0, boost: 4 } } },
      { match: { "Ordonnances médicales": { query: query, operator: "AND", fuzziness: 0, boost: 0.5 } } },
      { match: { "Conseils patient": { query: query, operator: "AND", fuzziness: 0, boost: 0.5 } } },
      { match: { "Informations cliniques - HTML": { query: query, operator: "AND", fuzziness: 0, boost: 0.3 } } },
    ]);

  return {
    query: {
      function_score: {
        query: {
          bool: {
            must: [{ bool: { should: should, minimum_should_match: 1 } }],
            filter: filter ? [{ wildcard: { Filtres: `*${filter}*` } }] : [],
            must_not: !filter
              ? [{ bool: { must: [{ wildcard: { Filtres: `*only*` } }, { bool: { must_not: [{ term: { Filtres: `all-only` } }] } }] } }]
              : [],
          },
        },
        boost_mode: "multiply",
        script_score: {
          script: {
            source: "double i = doc[params.f].size() == 0 ? 1 : doc[params.f].value; return Math.pow(1.5 * i, params.e);",
            params: { f: "Importance", e: query.trim().length <= 3 ? 0.5 : 0.25 },
          },
        },
      },
    },
    suggest: {
      med_suggest: {
        prefix: query,
        completion: { field: "Slug", fuzzy: { fuzziness: 2 }, size: 10 },
      },
    },
    _source: ["Name", "Slug", "Logo_for_finder_URL", "Wording_Logo", "Filtres"],
    size: page ? RESULTS_PAGE_SIZE : 10,
    from: page ? (page - 1) * RESULTS_PAGE_SIZE : 0,
    sort: [
      { _score: { order: "desc" } },
      { Alias: { order: "desc", missing: "_last" } },
      { "Ordonnances médicales": { order: "desc", missing: "_last" } },
      { "Conseils patient": { order: "desc", missing: "_last" } },
    ],
  };
}
// ---- fin du corps de la requête ----

async function search(query, filter, page) {
  try {
    // Block queries with no matching fiche (return empty instead of wrong fuzzy matches)
    if (BLOCKED_QUERIES.has(normalizeForBlocklist(query))) {
      return { results: [], fromSuggest: false };
    }

    const response = await fetchJson(`${ES_URL}/_search`, {
      method: "POST",
      headers: SEARCH_HEADERS,
      body: JSON.stringify(buildSearchBody(query, filter, page)),
    });

    const hits = response.data.hits.hits;
    var suggest = response.data.suggest && response.data.suggest.med_suggest;
    var suggestions = (suggest && suggest[0] && suggest[0].options) || [];

    const usingSuggestions = hits.length === 0 && suggestions.length > 0;
    const rawResults = usingSuggestions ? suggestions : hits;

    // Nombre total de fiches trouvées : la pagination de /search-result le lit ici, une
    // fois la réponse jugée à jour (elle ne se dessine plus depuis search(), où une
    // réponse dépassée la redessinait).
    var total = (response.data.hits.total && response.data.hits.total.value) || 0;

    const results = rawResults.map((item) => {
      const src = item._source || {};
      return {
        Name: src.Name,
        Slug: src.Slug,
        Img: src.Logo_for_finder_URL,
        wordingLogo: src.Wording_Logo,
        filtres: src.Filtres,
      };
    });

    // Pin the canonical fiche to #1 for known ambiguous short prefixes (see PINNED_FIRST).
    // Liste : la première fiche présente gagne (les autres ne sont pas regardées).
    const pinned = PINNED_FIRST[normalizeForBlocklist(query)];
    const pinSlugs = Array.isArray(pinned) ? pinned : (pinned ? [pinned] : []);
    for (var p = 0; p < pinSlugs.length; p++) {
      const pinIdx = results.findIndex((r) => r.Slug === pinSlugs[p]);
      if (pinIdx >= 0) {
        if (pinIdx > 0) results.unshift(results.splice(pinIdx, 1)[0]);
        break;
      }
    }

    return { results, fromSuggest: usingSuggestions, total };
  } catch (error) {
    console.error(error);
    return { results: [], fromSuggest: false, total: 0 };
  }
}

// Téléphone (< 480 px), champ principal (#search-bar-main, accueil) : la liste prend la
// largeur exacte du cadre du champ (son formulaire) et se pose 4 px dessous, encadrée
// comme sur ordinateur. Avant, elle débordait le champ de 8 px de chaque côté et la page
// se voyait sur ses bords. Le panneau de la loupe (#search-bar-nav) garde sa liste.
var MAIN_LIST_FRAME = "border: 1px solid var(--base-200, rgba(12, 14, 22, 0.2)); border-radius: 4px; overflow: hidden; box-shadow: 0 6px 16px -4px rgba(35, 38, 59, 0.15);";

function mainFieldFrame(input) {
  if (!input || input.id !== "search-bar-main" || !input.form) return null;
  if (window.matchMedia("(min-width: 480px)").matches) return null;
  return input.form.getBoundingClientRect();
}

function placeUnderMainField(list, frame) {
  list.style.width = `${frame.width}px`;
  list.style.left = `${frame.left + window.pageXOffset}px`;
  list.style.top = `${frame.bottom + window.pageYOffset + 4}px`;
}

// Fiche de deux modules (« Médecine générale & Rhumatologie ») : une icône par module,
// côte à côte, au lieu de l'image où les deux pastilles se chevauchent. Libellé inconnu :
// l'image de l'index.
var MODULE_ICONS = {
  "Médecine générale": "https://cdn.prod.website-files.com/604b9ac88b080efc7ce802bd/679772f5c754525604be565b_module-icon=moduleIcon-MG-16.svg",
  "Rhumatologie": "https://cdn.prod.website-files.com/604b9ac88b080efc7ce802bd/679772f508f722fd9d8889f0_module-icon=moduleIcon-Rhumato-16.svg",
  "Soins palliatifs": "https://cdn.prod.website-files.com/604b9ac88b080efc7ce802bd/679772f5dc51b632f1816365_module-icon=moduleIcon-SoinsPal-16.svg"
};

function moduleIconUrls(result) {
  var parts = String(result.wordingLogo || "").split(" & ");
  if (parts.length > 1 && parts.every(function (p) { return MODULE_ICONS[p]; })) {
    return parts.map(function (p) { return MODULE_ICONS[p]; });
  }
  return [result.Img];
}

// Display the search results
function displayResults(results, input, fromSuggest) {
  let resultList = document.getElementById("search-results");
  let searchResultInner = "";
  currentFocus = -1;   // nouvelle liste : plus rien de surligné

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
    const mainFrame = mainFieldFrame(input);

    if (window.matchMedia("(min-width: 480px)").matches) {
      resultList.style.cssText = "box-shadow: 0 0 0 1px rgb(35 38 59 / 10%), 0 6px 16px -4px rgb(35 38 59 / 15%); border-radius: 4px; padding: 8px; background: #fff;";
      if (input.id === "search-bar-nav") {
        resultList.style.width = `${inputRect.width * 2}px`;
        resultList.style.left = `${inputRect.left}px`;
      } else {
        resultList.style.width = `${inputRect.width}px`;
        resultList.style.left = `${inputRect.left}px`;
      }
    } else if (!mainFrame) {
      resultList.style.width = `calc(100% - 1rem)`;
      resultList.style.marginLeft = '.5rem';
      resultList.style.marginRight = '.5rem';
    }
    resultList.style.position = (input.id == "search-bar-main" || input.id == "search-bar-hp") ? "absolute" : "fixed";
    resultList.style.top =
      (input.id == "search-bar-main" || input.id == "search-bar-hp")
        ? `${inputRect.bottom + window.pageYOffset + 5}px`
        : `${inputRect.bottom + 5}px`;
    if (mainFrame) {
      resultList.style.cssText += MAIN_LIST_FRAME;
      placeUnderMainField(resultList, mainFrame);
    }
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
          try { setItemWithExpiration('filterTemp', activeFilter, 24); } catch (e) { /* stockage refusé : filtre gardé pour cette page */ }
          // Onglet précédent cherché dans CETTE liste, et absent toléré.
          var previous = (link.closest('#filter') || document).querySelector('a[data-w-tab="' + lastActiveTab + '"]');
          if (previous) previous.classList.remove('w--current');
          el.currentTarget.classList.add('w--current')
          lastActiveTab = el.currentTarget.getAttribute('data-w-tab');
          // Téléphone : l'onglet choisi passe en tête de la rangée (order: -1 du Designer) ;
          // la rangée revient au début pour qu'il reste à l'écran.
          var menu = link.closest('.srt-menu');
          if (menu) menu.scrollLeft = 0;
          clickEvent(activeFilter);
      })
    })

    resultList.appendChild(searchResult);
    document.querySelector("body").appendChild(resultList);
  }

  // Téléphone, champ principal : lignes de 48 px et texte à 16 px, comme dans le panneau
  // de la loupe. Marges plutôt que gap (navigateurs anciens).
  var mainRows = !!mainFieldFrame(input);

  if (fromSuggest && searchResultInner && typeof searchResultInner.appendChild === 'function') {
    const info = document.createElement("div");
    info.textContent = `0 résultats trouvés pour "${input.value}". Voici quelques suggestions :`;
    info.style.padding = mainRows ? "8px 12px 4px" : "4px 8px";
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

    resultElement.classList.add("search-result");
    const div =  document.createElement('div');

    div.style.cssText = "display: flex; align-items: center; padding: 4px; color: #0c0e16; font-size: 14px;border-radius:4px;white-space: nowrap;";
    div.style.backgroundColor = "transparent";

    var withLabel = window.matchMedia("(min-width: 480px)").matches && input.id != "search-bar-nav";
    if (withLabel){
      div.appendChild(document.createTextNode(result.wordingLogo));
      div.style.padding = "2px 8px";
    }
    moduleIconUrls(result).forEach(function (src, i) {
      const img = document.createElement("img");
      img.style.minWidth = "20px";
      img.style.height = "20px";
      img.setAttribute("src", src);
      // Icône seule (téléphone, barre de navigation) : la première porte le libellé en
      // texte alternatif ; à côté du libellé écrit, les icônes sont décoratives.
      img.alt = (!withLabel && i === 0) ? (result.wordingLogo || "") : "";
      if (i > 0) img.style.marginLeft = "4px";
      else if (withLabel) img.style.marginLeft = "5px";
      div.appendChild(img);
    });

    resultElement.style.cssText =
      "text-decoration: none; color: #0c0e16; padding: 8px 8px; display: flex; align-items: center; justify-content:space-between; font-size: 14px; border-radius: 4px;";
    if (mainRows) {
      resultElement.style.padding = "12px";
      resultElement.style.fontSize = "1rem";
      resultElement.style.borderRadius = "0";
      div.style.padding = "0";
      div.style.marginLeft = "12px";
    }

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
// Clé d'une requête : texte NFC, espaces de bord retirés, minuscules. Une même clé =
// un même document de comptage, et un seul comptage par page.
function queryKey(query) {
  return String(query).normalize("NFC").trim().toLowerCase();
}

// Identifiant du document d'une requête : SHA-1 de sa clé.
async function queryDocId(query) {
  var key = queryKey(query);
  var buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(key));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) {
    return ("0" + b.toString(16)).slice(-2);
  }).join("");
}

// Script stocké sur le serveur (finder-query-log) : heure du serveur, création des
// requêtes neuves, rien de créé pour une sortie sans clic sur une requête jamais comptée.
var QUERY_LOG_SCRIPT_ID = "finder-query-log";

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

    // Ni lettre ni chiffre (« ???? », « .... », « / ») : rien à compter.
    if (!/[\p{L}\p{N}]/u.test(query)) return;
    // Sans SHA-1 du navigateur (page non sécurisée, très vieille WebView) : pas de comptage.
    if (!window.crypto || !crypto.subtle || typeof TextEncoder === "undefined") return;

    var id = await queryDocId(query);
    // retry_on_conflict : deux visiteurs qui comptent la même requête au même instant.
    var updateUrl = `${ES_BASE_URL}${indexName}/_update/${id}?retry_on_conflict=3`;
    // Public by design (it ships to every browser): key limited to `search-queries`.
    var headers = {
      "Content-Type": "application/json",
      Authorization:
        "ApiKey N3B6V3M2QUJ6bmczS0FNZFQyS046Z0RDS0FXZWVTRUdTUkVqcFZfVHJidw==",
    };
    await fetchJson(updateUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        scripted_upsert: true,
        upsert: {},
        script: {
          id: QUERY_LOG_SCRIPT_ID,
          params: { kind: click ? "count" : "noclick", results: !!results, query: query },
        },
      }),
    });
  } catch (error) {
    console.error(`Error updating query count: ${error.message}`);
  }
}

