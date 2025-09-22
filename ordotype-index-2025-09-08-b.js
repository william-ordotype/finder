// ---------- Config ----------
const ES_BASE_URL = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";
const ES_INDEX_STAGING = "ordotype-index-2025-09-09";
const ES_INDEX_PRODUCTION = "ordotype-index-2025-09-09";

// Choose index by environment: staging (webflow) vs production
const IS_STAGING = window.location.hostname.includes("ordotype.webflow.io");
const ES_INDEX = IS_STAGING ? ES_INDEX_STAGING : ES_INDEX_PRODUCTION;

// Final Elasticsearch URL
const ES_URL = `${ES_BASE_URL}${ES_INDEX}`;

const baseUrl = window.location.origin;

let currentFocus;

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
const activePlanIds = JSON.parse(localStorage.getItem('_ms-mem') || '{}').planConnections?.filter(item => item.status === "ACTIVE" || item.status == "REQUIRES_PAYMENT").map(item => item.planId) || [];
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

searchBar?.addEventListener("input", async (event) => {
  await inputEvent(searchBar, event);
});

function handleSendResultsToGA(element) {
   window.dataLayer.push({ event: "show_search_results", element });
}

function handleSendClickResultToGA(element) {
  window.dataLayer.push({ event: "click_search_results", element });
}

searchBar?.addEventListener('blur', () => {
   var query = searchBar.value.trim()

   setTimeout(function() {
      query.length > 0 && updateQueryCount(query, true, false);
  }, 2000)
});

async function clickEvent(activeFilter) {
  const searchBar = searchBarMain || searchBarNav
  let query = searchBar.value.trim();
  let results = await search(query, activeFilter);
  if (results.length == 0) {
      let searchResults = document.getElementById("search-results");
      let searchResultInner = searchResults.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`)
      searchResultInner.innerHTML =
        `Pas de résultats pour "${query}", dans ce module.`;
      return true;
  }
  displayResults(results, searchBar);
}

async function inputEvent(input, e) {
  currentFocus = -1;

  const query = input.value.trim();
  if (query) {
    let results = await search(query, activeFilter);
    if (results.length == 0) {
      let searchResults = document.getElementById("search-results");
      searchResults.style.background = "#ffffff";
      searchResults.style.padding = "16px";
      searchResults.innerHTML =
        `Pas de résultats pour "${query}". Vérifiez l'orthographe de votre recherche`;
      if (e.inputType != "deleteContentBackward" && query.length > 3) {
        updateQueryCount(query, false);
      }
      return true;
    }
    if (e.inputType != "deleteContentBackward" && query.length > 3) {
      updateQueryCount(query);
    }
    if (e.inputType == "deleteContentBackward"){
      document.querySelector("#search-results")?.remove();
    }
    handleSendResultsToGA(input.id);
    displayResults(results, input);
  } else {
    document.querySelector("#search-results")?.remove();
  }
}

searchBar?.addEventListener("focus", async (e) => {
    if (window.innerWidth < 767) {
        const searchComponent = document.querySelector('#search-component');
        searchComponent.style.scrollMarginTop = '80px';

        const isIOS = /iP(hone|od|ad)/i.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
           setTimeout(() => {
             searchComponent.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
             window.scrollBy(0, 100);
           }, 100);
        } else {
          searchComponent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
   const query = searchBar.value.trim();

   if (query) {
    const results = await search(query, activeFilter);
    if (searchBarMain){
      handleSendResultsToGA("search-bar-focus");
    } else {
      handleSendResultsToGA("search-bar-nav-focus");
    }
    displayResults(results, searchBar);
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
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiration) {
    localStorage.removeItem(key);
    return null;
  }
  return item.value;
}

async function search(query, filter) {
  try {
    const response = await axios.post(
      `${ES_URL}/_search`,
      {
        query : {
          function_score : {
            query: {
              bool: {
                must: [
                  {
                    bool: {
                      should : [
                        {
                          query_string: {
                            query: query + "*",
                            fields: [
                              "Boost^30",
                              "Name^20",
                              "Alias^10",
                              "Ordonnances médicales^3",
                              "Conseils patient^2",
                              "Informations cliniques - HTML",
                            ]
                          }
                        },
                        { fuzzy: { Name: { value: query, fuzziness: "AUTO" } } },
                        { fuzzy: { Alias: { value: query, fuzziness: "AUTO" } } }
                      ]
                    }
                  }
                ],
                filter: filter ? [
                  { wildcard: { Filtres: `*${filter}*` } }
                ] : [],
                must_not: !filter ? [
                  {
                    bool: {
                      must: [
                        { wildcard: { Filtres: `*only*` } },
                        { bool: { must_not: [ { term: { Filtres: `all-only` } } ] } }
                      ]
                    }
                  }
                ] : []
              }
            },
            field_value_factor: {
              field: "importance",
              factor: 1.5,
              modifier: "none",
              missing : 1
            }
          }
        },
        size: 10,
        sort: [
          { _score: { order: "desc" } },
          { Alias: { order: "desc", missing: "_last" } },
          { "Ordonnances médicales": { order: "desc", missing: "_last" } },
          { "Conseils patient": { order: "desc", missing: "_last" } },
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "ApiKey WUdmSlhKa0J5bkFkTnVyZWNIMmk6YzlWel9vS09TMUtGR0k2V1NRZVJsZw==",
        },
      }
    );
      
    return response.data.hits.hits.map((hit) => ({
      Name: hit._source.Name,
      Slug: hit._source.Slug,
      Img: hit._source.Logo_for_finder_URL,
      wordingLogo: hit._source.Wording_Logo,
      filtres: hit._source.Filtres
    }));
  } catch (error) {
    console.error(error);
  }
}

// Display the search results
function displayResults(results, input) {
  let resultList = document.getElementById("search-results");
  let searchResultInner = "";
  
  if (resultList) {
    var searchResult = resultList.querySelector('#filter');
    searchResultInner = searchResult.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`);
    searchResultInner.innerHTML = "";
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

  results.forEach((result, index) => {
    if (result.filtres.includes("only")){
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
      handleSendClickResultToGA(input.id);
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
        "ApiKey WUdmSlhKa0J5bkFkTnVyZWNIMmk6YzlWel9vS09TMUtGR0k2V1NRZVJsZw==",
    };
    const response = await axios.get(searchUrl, { headers: searchHeaders });
    const hits = response.data.hits.total.value;

    if (hits > 0) {
      let hit = response.data.hits.hits[0];
      const queryId = hit._id;
      const updateUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/${indexName}/_update/${queryId}`;
      let updateData = {};
      
      if (!click) {
        if (hit._source.hasOwnProperty('noClick')) {
          updateData = {
            script: { source: "ctx._source.noClick += params.count", params: { count: 1 } }
          };
        } else {
          updateData = {
            script: { source: "ctx._source.noClick = params.count", params: { count: 1 } }
          };
        }
      } else {
        updateData = {
          script: { source: "ctx._source.count += params.count", params: { count: 1 } }
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
      const indexData = { query, count: 1 };
      if (!results) indexData.noResults = 1;
      await axios.post(indexUrl, indexData, { headers: searchHeaders });
    }
  } catch (error) {
    console.error(`Error updating query count: ${error.message}`);
  }
}
