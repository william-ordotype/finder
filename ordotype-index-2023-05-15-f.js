// Set up the Elasticsearch endpoint
const ES_ENDPOINT =
  "https://my-deployment-dd304c.es.europe-west1.gcp.cloud.es.io/my_index";

var currentFocus;

// Handle click outside of search results
document.addEventListener("click", ({ target }) => {
  const searchResults = document.getElementById("search-results");
  if (searchResults && !searchResults.contains(target)) {
    searchResults.remove();
  }
});

const searchBarNav = document.getElementById("search-bar-nav");
const searchBar = document.getElementById("search-bar");

searchBarNav?.addEventListener("input", async (event) => {
  await inputEvent(searchBarNav, event);
});

searchBar?.addEventListener("input", async (event) => {
  await inputEvent(searchBar, event);
});

function handleSendResultsToGA(element) {
  window.dataLayer.push({ event: "show_search_results", element });
}

function handleSendClickResultToGA(element) {
  window.dataLayer.push({ event: "click_search_results", element });
}

async function inputEvent(input, e) {
  currentFocus = 0;

  const query = input.value.trim();
  if (query) {
    let results = await search(query);
    if (results.length == 0) {
      results = await suggest(query);
    }
    if (results.length == 0) {
      document.getElementById("search-results").innerHTML =
        "Cette situation clinique n'est pas encore disponible";
      if (e.inputType != "deleteContentBackward" && query.length > 3) {
        updateQueryCount(query, true);
      }
      return true;
    }
    if (e.inputType != "deleteContentBackward" && query.length > 3) {
      updateQueryCount(query, true);
    }
    handleSendResultsToGA(input.id);
    displayResults(results, input);
  } else {
    document.querySelector("#search-results")?.remove();
  }
}

window.addEventListener("resize", () => {
  const inputRect = searchBar?.getBoundingClientRect();
  const div = document.querySelector("#search-results");
  if (div) {
    div.style.width = `${inputRect.width}px`;
    div.style.left = `${inputRect.left}px`;
    div.style.top = `${inputRect.bottom + 5}px`;
  }
});

searchBar?.addEventListener("focus", async () => {
  const query = searchBar.value.trim();

  if (query) {
    const results = await search(query);
    // handleSendResultsToGA("search-bar-focus");
    displayResults(results);
  }
});

searchBarNav?.addEventListener("focus", async () => {
  const query = searchBarNav.value.trim();

  if (query) {
    const results = await search(query);
    // handleSendResultsToGA("search-bar-nav-focus");
    displayResults(results);
  }
});

searchBarNav?.addEventListener("keydown", (e) => {
  keyDownEvent(e);
});

searchBar?.addEventListener("keydown", (e) => {
  keyDownEvent(e);
});

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

// Execute the Elasticsearch search query
async function search(query) {
  try {
    const response = await axios.post(
      "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/ordotype-index-2023-05-15-f/_search",
      {
        query: {
          query_string: {
            query: query + "*",
            fields: [
              "Boost^6"
              "Name^5",
              "Alias^4",
              "Ordonnances médicales^3",
              "Conseils patient^2",
              "Informations cliniques - HTML",
            ],
          },
        },
        size: 5,
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
            "ApiKey bFk2VGs0Y0JHcFJXRm1EZENyaGU6R0xpOHdPUENUSXlxS3NvMGhna3JTUQ==",
        },
      }
    );

    return response.data.hits.hits.map((hit) => ({
      Name: hit._source.Name,
      Slug: hit._source.Slug,
      // url: hit._source.url,
      gratos: hit._source.gratos,
      Img: hit._source.Logo_for_finder_URL,
    }));
  } catch (error) {
    console.error(error);
  }
}

async function suggest(query) {
  try {
    const response = await axios.post(
      "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/ordotype-index-2023-05-15-f/_search",
      {
        suggest: {
          suggestion: {
            prefix: query,
            completion: {
              field: "Slug",
              fuzzy: {
                fuzziness: "2",
              },
            },
          },
        },
        // size: 5,
        // sort: [
        //   { _score: { order: "desc" } },
        //   { Alias: { order: "desc", missing: "_last" } },
        //   { "Ordonnances médicales": { order: "desc", missing: "_last" } },
        //   { "Conseils patient": { order: "desc", missing: "_last" } }
        // ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "ApiKey bFk2VGs0Y0JHcFJXRm1EZENyaGU6R0xpOHdPUENUSXlxS3NvMGhna3JTUQ==",
        },
      }
    );

    return response.data.suggest.suggestion[0].options.map((option) => ({
      Name: option._source.Name,
      Slug: option._source.Slug,
      gratos: option._source.gratos,
      Img: option._source.Logo_for_finder_URL,
    }));
  } catch (error) {
    console.error(error);
  }
}

// Display the search results
function displayResults(results, input) {
  let resultList = document.getElementById("search-results");

  if (!resultList) {
    resultList = document.createElement("div");
    resultList.id = "search-results";

    resultList.style.cssText =
      "box-shadow: 0 0 0 1px rgb(35 38 59 / 10%), 0 6px 16px -4px rgb(35 38 59 / 15%); border-radius: 4px; padding: 8px;background: #fff;";
    resultList.style.position = input.id == "search-bar" ? "absolute" : "fixed";

    const inputRect = input.getBoundingClientRect();
    resultList.style.width = `${inputRect.width}px`;
    resultList.style.left = `${inputRect.left}px`;

    //const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    //if (isIOS) {
    //resultList.style.top = `${inputRect.bottom + window.pageYOffset + 5}px`; // Add 'window.pageYOffset' to account for scroll position
    //} else {
    // resultList.style.top = `${inputRect.bottom + 5}px`;
    //}
    resultList.style.top =
      input.id == "search-bar"
        ? `${inputRect.bottom + window.pageYOffset + 5}px`
        : `${inputRect.bottom + 5}px`;
    resultList.style.zIndex = input.id == "search-bar" ? "9999" : "10000";
    resultList.style.background = "white";

    document.querySelector("body").appendChild(resultList);
  }

  resultList.innerHTML = "";

  results.forEach((result, index) => {
    const resultElement = document.createElement("a");

    const img = document.createElement("img");
    img.setAttribute("src", result.Img);
    img.style.width = "120px";
    img.style.height = "30px";

    resultElement.classList.add("search-result");

    if (screen.width <= 768) {
      resultElement.style.cssText =
        "text-decoration: none; color: #0C0E16; padding: 12px 12px; display: flex; flex-direction: column; align-items: flex-start;";
    } else {
      resultElement.style.cssText =
        "text-decoration: none; color: #0C0E16; padding: 12px 12px; display: flex; align-items: center;";
      img.style.marginLeft = "auto";
    }

    if (index === 0) resultElement.classList.add("autocomplete-active");
    resultElement.href = "https://www.ordotype.fr/pathologies/" + result.Slug;
    resultElement.onmouseover = function () {
      this.style.background = "rgb(240,243,255)";
    };
    resultElement.onmouseout = function () {
      this.style.background = "none";
    };
    resultElement.innerText = result.Name;
    resultElement.onclick = () => handleSendClickResultToGA(input.id);

    result.gratos == "FALSE" && resultElement.appendChild(img);

    resultList.appendChild(resultElement);
  });
}

async function updateQueryCount(query, results) {
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
      const queryId = response.data.hits.hits[0]._id;
      const queryCount = response.data.hits.hits[0]._source.count;
      const updateUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_update/${queryId}`;
      const updateData = {
        script: {
          source: "ctx._source.count += params.count",
          params: {
            count: 1,
          },
        },
      };
      await axios.post(updateUrl, updateData, { headers: searchHeaders });
    } else {
      const indexUrl = `https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/search-queries/_doc`;
      const indexData = {
        query: query,
        count: 1,
        results: results,
      };
      await axios.post(indexUrl, indexData, { headers: searchHeaders });
    }
  } catch (error) {
    console.error(`Error updating query count: ${error.message}`);
  }
}
