var params = new URLSearchParams(location.search);
const query = params.get("query")
const page = params.get("page")
const baseUrl = window.location.origin.includes('webflow.io') 
    ? 'https://ordotype.webflow.io' 
    : 'https://www.ordotype.fr';

async function searchAll(query, page) {
    try {
      const response = await axios.post(
        "https://ordotype-finder.es.eu-west-3.aws.elastic-cloud.com/ordotype-test/_search",
        {
          query: {
            query_string: {
              query: query + "*",
              fields: [
                "Boost^6",
                "Name^5",
                "Alias^4",
                "Ordonnances médicales^3",
                "Conseils patient^2",
                "Informations cliniques - HTML",
              ],
            },
          },
          size: 10,
          from: page*10-10,
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
        
      document.getElementById('search-title').innerText = `${response.data.hits.total.value} Résultats pour "${query}"`;
      displayPagination(response.data.hits.total.value, query);
  
      return response.data.hits.hits.map((hit) => ({
        Name: hit._source.Name,
        Slug: hit._source.Slug,
        Img: hit._source.Logo_for_finder_URL,
        wordingLogo: hit._source.Wording_Logo
      }));
    } catch (error) {
      console.error(error);
    }
}

function displayPagination(totalResults, query){
  const totalPages = Math.ceil(totalResults / 10);
  const paginationDiv = document.getElementById('pagination');
  paginationDiv.style.cssText = "display: flex; justify-content: center; grid-column-gap: .5rem; align-items: center;"

  if (totalPages <= 7) {
    for (let index = 1; index <= totalPages; index++) {
      let link  = document.createElement('a')
      link.style.cssText = 'text-decoration: none;margin: 0px 10px; font-weight: 600; color: #0c0e16;'
      if (index == page) link.style.cssText = "background-color: #3454f6; color: white; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; padding: 0; text-decoration: none;";
      link.setAttribute('href', `http://ordotype.webflow.io/search-result?query=${query}&page=${index}`);
      let number = document.createTextNode(index);
      link.appendChild(number);
      paginationDiv.appendChild(link);
    }
  } else {
    for (let index = 1; index < 8; index++) {
        let link  = document.createElement('a')
        link.style.cssText = 'text-decoration: none;margin: 0px 10px; font-weight: 600; color: #0c0e16;'
        if (page <= 4 && index == page) link.style.cssText = "background-color: #3454f6; color: white; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; padding: 0; text-decoration: none;";
      
        let number = document.createTextNode(index);
        let href = index;
        switch (index) {
          case 2:
            if (page > 4) number = document.createTextNode('...');
            break;
          case 3:
            if (page > 4) {
              number = document.createTextNode(parseInt(page)-1);
              href = parseInt(page)-1;
            } 
            if ( page > totalPages - 3 ){ 
              number = document.createTextNode(totalPages - 4);
              href = totalPages - 4;
            }
            break;
          case 4:
            if (page > 4) {
              number = document.createTextNode(page);
              href = page;
            } 
            if (page > 4 && (page <= totalPages - 3)) link.style.cssText = "background-color: #3454f6; color: white; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; padding: 0; text-decoration: none;";
            if ( page > totalPages - 3 ){ 
              number = document.createTextNode(totalPages - 3);
              href = totalPages - 3;
              if(page == (totalPages - 3)) link.style.cssText = "background-color: #3454f6; color: white; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; padding: 0; text-decoration: none;";
            }
            break;
          case 5: 
            if (page > 4) {
              number = document.createTextNode(parseInt(page)+1);
              href = parseInt(page)+1;
            } 
            if ( page > totalPages - 3 ){ 
              number = document.createTextNode(totalPages - 2);
              href = totalPages - 2;
              if(page == (totalPages - 2)) link.style.cssText = "background-color: #3454f6; color: white; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; padding: 0; text-decoration: none;";
            }
            break;
          case 6:
            if ( page > totalPages - 3 ){
              number = document.createTextNode(totalPages - 1);
              href = totalPages - 1;
              if(page == (totalPages - 1)) link.style.cssText = "background-color: #3454f6; color: white; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; padding: 0; text-decoration: none;";
            } else {
              number = document.createTextNode('...');
            }
            break;
          case 7:
            number = document.createTextNode(totalPages);
            href = totalPages;
            if(page == totalPages) link.style.cssText = "background-color: #3454f6; color: white; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; padding: 0; text-decoration: none;";
            break;
          default:
            break;
        }

        link.setAttribute('href', `${baseUrl}/search-result?query=${query}&page=${href}`);
        link.appendChild(number);
        paginationDiv.appendChild(link);
    }
  }
}

document.addEventListener("DOMContentLoaded", async function(){
    let results = await searchAll(query, page);
    if (results.length == 0) {
      results = await suggest(query);
      document.getElementById('suggestions').innerText = 'Voici quelques suggestions';
    }
    let resultList = document.getElementById("search-result-wraper");
    results.forEach((result, index) => {
        const resultElement = document.createElement("a");
    
        const img = document.createElement("img");
        img.style.width = "16px";
        img.style.height = "16px";
    
        resultElement.classList.add("search-result");
        const div =  document.createElement('div');
    
        // Check the gratos value and set the image source or make it invisible
        img.setAttribute("src", result.Img);
        div.style.cssText = "background-color: #0c0e160d; display: flex; align-items: center; padding: 4px; color: #0c0e16b3; font-size: 14px;border-radius:4px;";
        if (window.matchMedia("(min-width: 480px)").matches){
          div.appendChild(document.createTextNode(result.wordingLogo));
          img.style.marginLeft = "5px";  // Add some space between the image and the text
          div.style.padding = "2px 8px";
        } 
        div.appendChild(img);
    
        resultElement.style.cssText =
           "text-decoration: none; color: #0C0E1699; font-size: 16px; padding: 16px 8px; display: flex; align-items: center; justify-content:space-between";
    
        resultElement.addEventListener("click", function(event) {
            event.preventDefault();
            // handleSendClickResultToGA(input.id);
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
        resultElement.appendChild(div)
    
        resultList.appendChild(resultElement);
    });
});
