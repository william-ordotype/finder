//Set up the Elasticsearch endpoint
const ES_ENDPOINT = "https://my-deployment-dd304c.es.europe-west1.gcp.cloud.es.io/my_index";

// Define Elasticsearch base URLs for staging, production, and Tunisia
const ES_BASE_URL_STAGING = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";
const ES_BASE_URL_PRODUCTION = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";
const ES_BASE_URL_TUNISIA = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";

// Define index names for staging, production, and Tunisia
const ES_INDEX_STAGING = "ordotype-index-2024-10-01"; // old: ordotype-index-staging-2024-01-04 
const ES_INDEX_PRODUCTION = "ordotype-index-2024-10-01"; // old: ordotype-index-2023-12-21c
const ES_INDEX_TUNISIA = "ordotype-index-2024-10-01"; // new index for Tunisia

// Determine the current environment and set the Elasticsearch index
let ES_INDEX, ES_BASE_URL;

if (window.location.hostname.includes("ordotype.webflow.io")) {
    ES_INDEX = ES_INDEX_STAGING;
    ES_BASE_URL = ES_BASE_URL_STAGING;
} else if (window.location.hostname.includes("ordotype-tunisie.webflow.io")) {
    ES_INDEX = ES_INDEX_TUNISIA;
    ES_BASE_URL = ES_BASE_URL_TUNISIA;
} else {
    ES_INDEX = ES_INDEX_PRODUCTION;
    ES_BASE_URL = ES_BASE_URL_PRODUCTION;
}

// Use this to construct your Elasticsearch URL for search and suggest functions
const ES_URL = `${ES_BASE_URL}${ES_INDEX}`;

const baseUrl = window.location.origin.includes('webflow.io')
  ? (window.location.origin.includes('tunisie') 
      ? 'https://ordotype-tunisie.webflow.io' 
      : 'https://ordotype.webflow.io')
  : (window.location.origin.includes('.tn') 
      ? 'https://www.ordotype.tn' 
      : 'https://www.ordotype.fr');

var currentFocus;

// Handle click outside of search results
document.addEventListener("click", ({ target }) => {
  const searchResults = document.getElementById("search-results");
  if (searchResults && !searchResults.contains(target)) {
    searchResults.remove();
  }
});

const searchBarNav = document.getElementById("search-bar-nav");
const searchBarMain = document.getElementById("search-bar-main");
if(window.location.pathname.includes("search-result") && window.innerWidth > 767){
  searchBar = searchBarNav;
}else{
  searchBar = searchBarMain || searchBarNav;
}

var lastActiveTab = 'Tab 1';
var activeFilter = getItemWithExpiration('filter') || "";

searchBar?.addEventListener("input", async (event) => {
  await inputEvent(searchBar, event);
});

function handleSendResultsToGA(element) {
   window.dataLayer.push({ event: "show_search_results", element });
 }

function handleSendClickResultToGA(element) {
  window.dataLayer.push({ event: "click_search_results", element });
}

searchBarNav?.addEventListener('blur', () => {
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
  currentFocus = 3;

  const query = input.value.trim();
  if (query) {
    let filterStored = getItemWithExpiration('filter') || "";
    let results = await search(query, filterStored);
    if (results.length == 0) {
      results = await suggest(query);
    }
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
    handleSendResultsToGA(input.id);
    displayResults(results, input);
  } else {
    document.querySelector("#search-results")?.remove();
  }
}

window.addEventListener("resize", () => {
  const searchBar = searchBarMain || searchBarNav
  const inputRect = searchBar?.getBoundingClientRect();
  const div = document.querySelector("#search-results");
  if (div) {
    div.style.width = `${inputRect.width}px`;
    div.style.left = `${inputRect.left}px`;
    div.style.top = `${inputRect.bottom + 5}px`;
  }
});

searchBarNav?.addEventListener("focus", async () => {
   const query = searchBar.value.trim();

   if (query) {
    const results = await search(query);
    if(searchBarMain){
      handleSendResultsToGA("search-bar-focus");
    }else{
      handleSendResultsToGA("search-bar-nav-focus");
    }
    displayResults(results);
   }
});

searchBar?.addEventListener("keydown", (e) => {
  keyDownEvent(e);
});

const searchBtn = document.getElementById("search-btn");

if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    const query = document.getElementById("search-bar-main").value.trim();
    window.location.href = `${baseUrl}/search-result?query=${query}&page=1`;
  });
} 

if (window.matchMedia("(max-width: 768px)").matches){
    const searchComponent = document.getElementById('search-component');
    if (searchComponent) {
        searchComponent.addEventListener("click", () => {
        window.location.href = `${baseUrl}/search-result`;
  });
}}

function keyDownEvent(e) {
  var x = document.getElementById("search-results");
  if (x) x = x.getElementsByTagName("a");
  if (e.keyCode == 40) {
    currentFocus++;
    /*and and make the current item more visible:*/
    addActive(x);
  } else if (e.keyCode == 38) {
    //up
    /*If the arrow UP key is pressed,
    decrease the currentFocus variable:*/
    currentFocus--;
    /*and and make the current item more visible:*/
    addActive(x);
  } else if (e.keyCode == 13) {
    /*If the ENTER key is pressed, prevent the form from being submitted,*/
    e.preventDefault();
    if (currentFocus > -1) {
      /*and simulate a click on the "active" item:*/
      if (x) x[currentFocus].click();
    } else {
        const query = e.currentTarget.value.trim();
        window.location.href = `${baseUrl}/search-result?query=${query}&page=1`;
    }
  }
}

function addActive(x) {
  /*a function to classify an item as "active":*/
  if (!x) return false;
  /*start by removing the "active" class on all items:*/
  removeActive(x);
  if (currentFocus >= x.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = x.length - 1;
  /*add class "autocomplete-active":*/
  x[currentFocus].classList.add("autocomplete-active");
}

function removeActive(x) {
  /*a function to remove the "active" class from all autocomplete items:*/
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
    const item = {
        value: value,
        expiration: expirationTime
    };
    localStorage.setItem(key, JSON.stringify(item));
}

function getItemWithExpiration(key) {
    const itemStr = localStorage.getItem(key);
    
    // Si l'élément n'existe pas
    if (!itemStr) {
        return null;
    }
    
    const item = JSON.parse(itemStr);
    const now = new Date();
    
    // Vérifie si l'élément est expiré
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
      //"https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/test/_search",
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
                                  "Boost^6",
                                  "Name^5",
                                  "Alias^4",
                                  "Ordonnances médicales^3",
                                  "Conseils patient^2",
                                  "Informations cliniques - HTML",
                              ]
                            }
                          },
                          {
                            fuzzy: {
                              Name: {
                                  value: query,
                                  fuzziness: "AUTO"
                              }
                            }
                          },
                          {
                            fuzzy: {
                              Alias: {
                                  value: query,
                                  fuzziness: "AUTO"
                              }
                            }
                          }
                        ]
                      }
                    }
                  ],
                  "filter": filter ? [
                  {
                    "wildcard": {
                      "Filtres": `*${filter}*`
                    }
                  }
                ] : [],
                "must_not": !filter ? [
                {
                  "bool": {
                    "must": [
                      {
                        "wildcard": {
                          "Filtres": `*only*`
                        }
                      },
                      {
                        "bool": {
                          "must_not": [
                            {
                              "term": {
                                "Filtres": `all-only`
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
                ] : []
              }
            },
            field_value_factor: {
              field: "importance",  // Champ numérique utilisé pour la pondération
              factor: 1.5,          // Facteur multiplicatif pour ajuster l'impact
              modifier: "none",      // Modificateur pour ajuster l'influence (options : "none", "sqrt", "log", etc.)
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
            "ApiKey bFk2VGs0Y0JHcFJXRm1EZENyaGU6R0xpOHdPUENUSXlxS3NvMGhna3JTUQ==",
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

// async function suggest(query) {
//   try {
//     const response = await axios.post(
//       `${ES_URL}/_search`,
//       //"https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/ordotype-index-staging-2024-05-23/_search",
//       {
//         suggest: {
//           suggestion: {
//             prefix: query,
//             completion: {
//               field: "Slug",
//               fuzzy: {
//                 fuzziness: "2",
//               },
//             },
//           },
//         },
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization:
//             "ApiKey bFk2VGs0Y0JHcFJXRm1EZENyaGU6R0xpOHdPUENUSXlxS3NvMGhna3JTUQ==",
//         },
//       }
//     );

//     return response.data.suggest.suggestion[0].options.map((option) => ({
//       Name: option._source.Name,
//       Slug: option._source.Slug,
//       wordingLogo: hit._source.Wording_Logo,
//       Img: option._source.Logo_for_finder_URL,
//     }));
//   } catch (error) {
//     console.error(error);
//   }
// }

// Display the search results
function displayResults(results, input) {
  let resultList = document.getElementById("search-results");
  let searchResultInner = ""
  
  if (resultList) {
    var searchResult = resultList.querySelector('#filter');
    searchResultInner = searchResult.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`);
    searchResultInner.innerHTML = "";
  }
  
  if (!resultList) {
    resultList = document.createElement("div");
    resultList.id = "search-results";

    const inputRect = input.getBoundingClientRect();
    
    if (window.matchMedia("(min-width: 480px)").matches){
    resultList.style.cssText =
      "box-shadow: 0 0 0 1px rgb(35 38 59 / 10%), 0 6px 16px -4px rgb(35 38 59 / 15%); border-radius: 4px; padding: 8px;background: #fff;";
      resultList.style.width = `${inputRect.width}px`;
      resultList.style.left = `${inputRect.left}px`;
    }
    else {
       resultList.style.width = `calc(100% - 2rem)`;
       resultList.style.marginLeft = '1rem';
       resultList.style.marginRight = '1rem';
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
        
            // Calculer la position de défilement en fonction de la position de la souris
            const scrollPercentage = mouseX / containerWidth;
            const scrollPosition = (contentWidth - containerWidth) * scrollPercentage;
        
            scrollContent.style.transform = `translateX(${-scrollPosition}px)`;
        });
    }
    searchResultInner = searchResult.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`)
    searchResult.querySelectorAll('a').forEach((link, index) => {
    let filterStored = getItemWithExpiration('filter');  
    if (filterStored) {
      if (index === 0) link.classList.remove('w--current');
      if (filterStored == transformString(link.innerText)) {
        link.classList.add('w--current');
        lastActiveTab = link.getAttribute('data-w-tab');
      }
    }   
      link.addEventListener('click', (el) => {
          el.preventDefault();
          stringifiedFilter = transformString(el.target.innerText);
          activeFilter = el.target.innerText != "Tous les résultats" ? stringifiedFilter : "";
          setItemWithExpiration('filter', activeFilter, 24);
          document.querySelector('#filter a[data-w-tab="'+lastActiveTab+'"]').classList.remove('w--current');
          el.currentTarget.classList.add('w--current')
          lastActiveTab = el.currentTarget.getAttribute('data-w-tab');
          clickEvent(activeFilter) ;
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
        }else {
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
      img.style.marginLeft = "5px";  // Add some space between the image and the text
      div.style.padding = "2px 8px";    
    } 
    div.appendChild(img);
    
    resultElement.style.cssText =
            "text-decoration: none; color: #0c0e16; padding: 8px 8px; display: flex; align-items: center; justify-content:space-between; font-size: 14px;";

    resultElement.addEventListener("click", function(event) {
        event.preventDefault();
        handleSendClickResultToGA(input.id);
        window.location.href = `${baseUrl}/pathologies/${result.Slug}`;
    });

    //if (index === 0) resultElement.classList.add("autocomplete-active");
    resultElement.href = `${baseUrl}/pathologies/${result.Slug}`;
    resultElement.onmouseover = function () {
        this.style.background = "rgb(240,243,255)";
    };
    resultElement.onmouseout = function () {
        this.style.background = "none";
    };

    // Append elements to the resultElement
    resultElement.appendChild(document.createTextNode(result.Name));  // Add text node after img
    resultElement.appendChild(div);  // Add img element

    searchResultInner.appendChild(resultElement);
});

}

async function updateQueryCount(query, results = true, click = true) {
   try {
     const searchUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_search?q=query:${encodeURIComponent(
       query
     )}`;
     const searchHeaders = {
       "Content-Type": "application/json",
       Authorization:
         "ApiKey bFk2VGs0Y0JHcFJXRm1EZENyaGU6R0xpOHdPUENUSXlxS3NvMGhna3JTUQ==",
     };
     const response = await axios.get(searchUrl, { headers: searchHeaders });
     const hits = response.data.hits.total.value;

     if (hits > 0) {
       let hit = response.data.hits.hits[0];
      
      const queryId = hit._id;
       const queryCount = hit._source.count;
       const updateUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_update/${queryId}`;
       let updateData = {};
      
       if (!click) {
         if(hit._source.hasOwnProperty('noClick')){
           updateData = {
            script: {
               source: "ctx._source.noClick += params.count",
               params: {
                   count: 1
              }
             }
          };
         }else {
           updateData = {
             script: {
               source: "ctx._source.noClick = params.count",
               params: {
                   count: 1
               }
             }
           };
         }
       }else {
         updateData = {
           script: {
             source: "ctx._source.count += params.count",
             params: {
                 count: 1
             }
           }
         };
            
         if (!results) {
           if(hit._source.hasOwnProperty('noResults')){
             updateData.script.source += "; ctx._source.noResults += 1";
           }else {
             updateData.script.source += "; ctx._source.noResults = 1";
           }
         }
       }

       await axios.post(updateUrl, updateData, { headers: searchHeaders });
     } else {
       const indexUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_doc`;
       const indexData = {
         query: query,
         count: 1,
       };

       if (!results) {
         indexData.noResults = 1;
       }
      
       await axios.post(indexUrl, indexData, { headers: searchHeaders });
     }
   } catch (error) {
     console.error(`Error updating query count: ${error.message}`);
   }
 }