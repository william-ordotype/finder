//Set up the Elasticsearch endpoint
// const ES_ENDPOINT = "https://my-deployment-dd304c.es.europe-west1.gcp.cloud.es.io/my_index";

// Define Elasticsearch base URLs for staging and production
// const ES_BASE_URL_STAGING = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";
// const ES_BASE_URL_PRODUCTION = "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/";

// Define index names for staging and production
// const ES_INDEX_STAGING = "ordotype-index-2024-06-12"; // old: ordotype-index-staging-2024-01-04 
// const ES_INDEX_PRODUCTION = "ordotype-index-2024-06-12"; // old : ordotype-index-2023-12-21c

// Determine the current environment and set the Elasticsearch index
// const ES_INDEX = window.location.hostname.includes("webflow.io") 
//      ? ES_INDEX_STAGING 
//      : ES_INDEX_PRODUCTION;

// // Use this to construct your Elasticsearch URL for search and suggest functions
// const ES_URL = window.location.hostname.includes("webflow.io")
//      ? `${ES_BASE_URL_STAGING}${ES_INDEX}`
//      : `${ES_BASE_URL_PRODUCTION}${ES_INDEX}`;

// const baseUrl = window.location.origin.includes('webflow.io') 
// ? 'https://ordotype.webflow.io' 
// : 'https://www.ordotype.fr';

// var currentFocus;

// // Handle click outside of search results
// document.addEventListener("click", ({ target }) => {
//   const searchResults = document.getElementById("search-results");
//   if (searchResults && !searchResults.contains(target)) {
//     searchResults.remove();
//   }
// });

// const searchBarNav = document.getElementById("search-bar-nav");
// const searchBarMain = document.getElementById("search-bar-main");
// //const searchBarHomepage = document.getElementById("search-bar-hp");
var lastActiveTab = 'Tab 1';
var activeFilter = localStorage.getItem('filter') || "";

// searchBarNav?.addEventListener("input", async (event) => {
//    await inputEvent(searchBarNav, event);
// });

// if (window.matchMedia("(max-width: 768px)").matches){
//     document.getElementById('search-component').addEventListener("click", () => {
//     window.location.href = `${baseUrl}/search-result`;
//   });
// }

// searchBarMain?.addEventListener("input", async (event) => {
//   await inputEvent(searchBarMain, event);
// });

// searchBarHomepage?.addEventListener("input", async (event) => {
//   await inputEvent(searchBarHomepage, event);
// });

// function handleSendResultsToGA(element) {
//    window.dataLayer.push({ event: "show_search_results", element });
//  }

// function handleSendClickResultToGA(element) {
//   window.dataLayer.push({ event: "click_search_results", element });
// }

// searchBarNav?.addEventListener('blur', () => {
//    var query = searchBarNav.value.trim()

//    setTimeout(function() {
//       query.length > 0 && updateQueryCount(query, true, false);
//   }, 2000)
// });

// searchBarMain?.addEventListener('blur', () => {
//   var query = searchBarMain.value.trim()

//   setTimeout(function() {
//       query.length > 0 && updateQueryCount(query, true, false);
//   }, 2000)
// });

// // searchBarHomepage?.addEventListener('blur', () => {
// //   var query = searchBarHomepage.value.trim()
// //   setTimeout(function() {
// //       query.length > 0 && updateQueryCount(query, true, false);
// //   }, 2000)
// // });

async function clickEvent(activeFilter) {
  let query = searchBarNav.value.trim();
  let results = await search(query, activeFilter);
  if (results.length == 0) {
      let searchResults = document.getElementById("search-results");
      let searchResultInner = searchResults.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`)
      searchResultInner.innerHTML =
        `Pas de résultats pour "${query}", dans ce module.`;
      return true;
  }
  displayResults(results, searchBarNav);
}

// async function inputEvent(input, e) {
//   currentFocus = -1;

async function inputEvent(input, e) {
  currentFocus = -1;

  const query = input.value.trim();
  if (query) {
    let filterStored = localStorage.getItem('filter') || "";
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

// window.addEventListener("resize", () => {
//   const inputRect = searchBarMain?.getBoundingClientRect();
//   const div = document.querySelector("#search-results");
//   if (div) {
//     div.style.width = `${inputRect.width}px`;
//     div.style.left = `${inputRect.left}px`;
//     div.style.top = `${inputRect.bottom + 5}px`;
//   }
// });

// searchBarMain?.addEventListener("focus", async () => {
//   const query = searchBarMain.value.trim();

//   if (query) {
//     const results = await search(query);
//     handleSendResultsToGA("search-bar-focus");
//     displayResults(results);
//   }
// });

// searchBarNav?.addEventListener("focus", async () => {
//    const query = searchBarNav.value.trim();https://github.com/william-ordotype/finder/blob/main/ordotype-index-2024-06-04.js

//    if (query) {
//     const results = await search(query);
//     handleSendResultsToGA("search-bar-nav-focus");
//     displayResults(results);
//    }
// });

// searchBarHomepage?.addEventListener("focus", async () => {
//   const query = searchBarHomepage.value.trim();
//   if (query) {
//     const results = await search(query);
//     displayResults(results);
//   }
// });

// searchBarNav?.addEventListener("keydown", (e) => {
//   keyDownEvent(e);
// });

// searchBarMain?.addEventListener("keydown", (e) => {
//   keyDownEvent(e);
// });

// // searchBarHomepage?.addEventListener("keydown", (e) => {
// //   keyDownEvent(e);
// // });

// const searchBtn = document.getElementById("search-btn");

// if (searchBtn) {
//   searchBtn.addEventListener('click', () => {
//     const query = document.getElementById("search-bar-main").value.trim();
//     window.location.href = `${baseUrl}/search-result?query=${query}&page=1`;
//   });
// } 

// function keyDownEvent(e) {
//   var x = document.getElementById("search-results");
//   if (x) x = x.getElementsByTagName("a");
//   if (e.keyCode == 40) {
//     currentFocus++;
//     /*and and make the current item more visible:*/
//     addActive(x);
//   } else if (e.keyCode == 38) {
//     //up
//     /*If the arrow UP key is pressed,
//     decrease the currentFocus variable:*/
//     currentFocus--;
//     /*and and make the current item more visible:*/
//     addActive(x);
//   } else if (e.keyCode == 13) {
//     /*If the ENTER key is pressed, prevent the form from being submitted,*/
//     e.preventDefault();
//     if (currentFocus > -1) {
//       /*and simulate a click on the "active" item:*/
//       if (x) x[currentFocus].click();
//     } else {
//         const query = e.currentTarget.value.trim();
//         window.location.href = `${baseUrl}/search-result?query=${query}&page=1`;
//     }
//   }
// }

// function addActive(x) {
//   /*a function to classify an item as "active":*/
//   if (!x) return false;
//   /*start by removing the "active" class on all items:*/
//   removeActive(x);
//   if (currentFocus >= x.length) currentFocus = 0;
//   if (currentFocus < 0) currentFocus = x.length - 1;
//   /*add class "autocomplete-active":*/
//   x[currentFocus].classList.add("autocomplete-active");
// }

// function removeActive(x) {
//   /*a function to remove the "active" class from all autocomplete items:*/
//   for (var i = 0; i < x.length; i++) {
//     x[i].classList.remove("autocomplete-active");
//   }
// }

async function search(query, filter) {
  try {
    const response = await axios.post(
      //`${ES_URL}/_search`,
      "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/ordotype-test/_search",
      {
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
                      "Wording_Logo": `*${filter}*`
                    }
                  }
                ] : []
              }
          },
        size: 6,
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

// // Execute the Elasticsearch search query
// async function search(query) {
//   try {
//     const response = await axios.post(
//       `${ES_URL}/_search`,
//     //"https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/ordotype-index-staging-2024-05-23/_search",
//       {
//         query: {
//           bool: {
//             should : [
//               {
//                 query_string: {
//                   query: query + "*",
//                   fields: [
//                     "Boost^6",
//                     "Name^5",
//                     "Alias^4",
//                     "Ordonnances médicales^3",
//                     "Conseils patient^2",
//                     "Informations cliniques - HTML",
//                   ],
//                 },
//               },
//               {
//                 fuzzy: {
//                   Name: {
//                     value: query,
//                     fuzziness: "AUTO"
//                   }
//                 }
//               },
//               {
//                 fuzzy: {
//                   Alias: {
//                     value: query,
//                     fuzziness: "AUTO"
//                   }
//                 }
//               }
//             ]
//           }
//         },
//         size: 6,
//         sort: [
//           { _score: { order: "desc" } },
//           { Alias: { order: "desc", missing: "_last" } },
//           { "Ordonnances médicales": { order: "desc", missing: "_last" } },
//           { "Conseils patient": { order: "desc", missing: "_last" } },
//         ],
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization:
//             "ApiKey bFk2VGs0Y0JHcFJXRm1EZENyaGU6R0xpOHdPUENUSXlxS3NvMGhna3JTUQ==",
//         },
//       }
//     );

//     return response.data.hits.hits.map((hit) => ({
//       Name: hit._source.Name,
//       Slug: hit._source.Slug,
//       wordingLogo: hit._source.Wording_Logo,
//       Img: hit._source.Logo_for_finder_URL,
//     }));
//   } catch (error) {
//     console.error(error);
//   }
// }

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

    let searchResultOriginal = document.querySelector('#search-result');
    var searchResult = searchResultOriginal.cloneNode(true);
    searchResult.id = "filter";
    searchResult.style.display = "block";
    const scrollContainer = searchResult.querySelector('.srt-menu');
    if (scrollContainer) {
        scrollContainer.addEventListener('wheel', (evt) => {
            evt.preventDefault(); // Empêche le défilement vertical
            scrollContainer.scrollLeft += evt.deltaY; // Applique le défilement horizontal
        });
    }
    searchResultInner = searchResult.querySelector(`div[data-w-tab="Tab 1"] div.search-result-body`)
    searchResult.querySelectorAll('a').forEach((link, index) => {
    let filterStored = localStorage.getItem('filter')
    if (filterStored) {
      if (index === 0) link.classList.remove('w--current');
      if (filterStored == link.innerText) {
        link.classList.add('w--current');
        lastActiveTab = link.getAttribute('data-w-tab');
      }
    }   
      link.addEventListener('click', (el) => {
          el.preventDefault();
          activeFilter = el.target.innerText != "Tous les résultats" ? el.target.innerText : "";
          localStorage.setItem('filter', activeFilter);
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
          filter = activeFilter.toString()                  
                                .normalize('NFD')   
                                .replace(/[\u0300-\u036f]/g, '')  
                                .toLowerCase() 
                                .trim() 
                                .replace(/[^a-z0-9\s-]/g, '')  
                                .replace(/\s+/g, '-') 
                                .replace(/-+/g, '-');
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
//       div.style.backgroundColor = "#0c0e160d";
       
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

// async function updateQueryCount(query, results = true, click = true) {
//    try {
//      const searchUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_search?q=query:${encodeURIComponent(
//        query
//      )}`;
//      const searchHeaders = {
//        "Content-Type": "application/json",
//        Authorization:
//          "ApiKey bFk2VGs0Y0JHcFJXRm1EZENyaGU6R0xpOHdPUENUSXlxS3NvMGhna3JTUQ==",
//      };
//      const response = await axios.get(searchUrl, { headers: searchHeaders });
//      const hits = response.data.hits.total.value;

//      if (hits > 0) {
//        let hit = response.data.hits.hits[0];
      
//       const queryId = hit._id;
//        const queryCount = hit._source.count;
//        const updateUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_update/${queryId}`;
//        let updateData = {};
      
//        if (!click) {
//          if(hit._source.hasOwnProperty('noClick')){
//            updateData = {
//             script: {
//                source: "ctx._source.noClick += params.count",
//                params: {
//                    count: 1
//               }
//              }
//           };
//          }else {
//            updateData = {
//              script: {
//                source: "ctx._source.noClick = params.count",
//                params: {
//                    count: 1
//                }
//              }
//            };
//          }
//        }else {
//          updateData = {
//            script: {
//              source: "ctx._source.count += params.count",
//              params: {
//                  count: 1
//              }
//            }
//          };
            
//          if (!results) {
//            if(hit._source.hasOwnProperty('noResults')){
//              updateData.script.source += "; ctx._source.noResults += 1";
//            }else {
//              updateData.script.source += "; ctx._source.noResults = 1";
//            }
//          }
//        }

//        await axios.post(updateUrl, updateData, { headers: searchHeaders });
//      } else {
//        const indexUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_doc`;
//        const indexData = {
//          query: query,
//          count: 1,
//        };

//        if (!results) {
//          indexData.noResults = 1;
//        }
      
//        await axios.post(indexUrl, indexData, { headers: searchHeaders });
//      }
//    } catch (error) {
//      console.error(`Error updating query count: ${error.message}`);
//    }
//  }
