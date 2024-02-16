
window.memberstack = window.memberstack || {}
window.memberstack.instance = $memberstackDom;
  
            const isAuthenticated = async(fn,reload=false)=>{
                let member
                if (!window.memberstack?.user || reload === true) {
                    try {
                        member = await memberstack.instance.getCurrentMember()
                    } catch (err) {
                        fn(err, null)
                    }

                } else {
                    if (window.memberstack.user) {
                        console.log('authenticated')
                        
                        return fn(null, window.memberstack.user);
                    } else {
                        console.log('not authenticated')
                    }
                }
                if (member.data) {
                    console.log('authenticated')
                    memberstack.user = {...member.data};
                    return fn(null, member['data']);
                } else {
                    console.log('not authenticated')
                }
            }
            
          async function getId() {
  let prevId;
  let currId;
              
  await isAuthenticated((err, user) => {
    if(err) {
      return console.log(err);
    }
    prevId = user.customFields['v1-member-id'] || null;
    currId = user.id
  })
  return [currId, prevId];
}
          
          
          
            getId().then((ids) => {
				window.memberstack.information = {
                	id: ids[0]
                }
            })

window.onload = function () {
  const {
    h
  } = window['preact'];

  const {
    getAlgoliaResults
  } = window['@algolia/autocomplete-js'];
  
  window.autocomplete = window['@algolia/autocomplete-js'].autocomplete
  const { createAlgoliaInsightsPlugin } = window[
    '@algolia/autocomplete-plugin-algolia-insights'
  ];

  
    const appId = 'TDNYD0DXDQ'
  const apiKey = '616dc37f94cf62fcf064bbce0ee53b32'
  var searchClient = algoliasearch(
   appId,
    apiKey
  );
// Insights client
  var insightsClient = window.aa
  insightsClient('init', { appId, apiKey, useCookie: true });
  
  window.aa('onUserTokenChange', (userToken) => {
  window.dataLayer.push({
    algoliaUserToken: userToken,
  });
}, { immediate: true });
  
var algoliaInsightsPlugin = createAlgoliaInsightsPlugin({
  insightsClient,
  onItemsChange({
    insights,
    insightsEvents
  }) {
    const events = insightsEvents.map((insightsEvent) => ({
      ...insightsEvent,
      eventName: 'Product Viewed from Autocomplete',
    }));
    insights.viewedObjectIDs(...events);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'search_view',
      index: events[0].index,
      objectIDs: events[0].objectIDs
      });
    console.log('view event', ...events)
  },
  onSelect({
    insights,
    insightsEvents
  }) {
    const events = insightsEvents.map((insightsEvent) => ({
      ...insightsEvent,
      eventName: 'Product Selected from Autocomplete',
    }));
    insights.clickedObjectIDsAfterSearch(...events);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'search_click',
      index: events[0].index,
      objectIds: events[0].objectIDs,
      positions: events[0].positions,
      queryID: events[0].queryID
      });
    console.log('clicked event', ...events)
  },
})

  $('#nav-autocomplete').length && autocomplete({
    container: '#nav-autocomplete',
    plugins: [algoliaInsightsPlugin],
    placeholder: 'Rechercher...',
    defaultActiveItemId: 0,
     detachedMediaQuery: 'none',
    getSources() {
      return [{
        getItems({
          query
        }) {
          return getAlgoliaResults({
            searchClient,
            queries: [{
              indexName: 'pathologies',
              query,
              params: {
                  clickAnalytics: true,
                },
            }, ],
          });
        },
        getItemUrl({
          item
        }) {
          const path = '/pathologies/'
          return path + item.Slug
        },
        templates: {
          item({
            item,
            createElement
          }) {
            	
              if (item.gratos=='TRUE') {

           		 return createElement('div', {
              	dangerouslySetInnerHTML: {
                __html: `<a class="algolia-item" href="/pathologies/${item.Slug}">

                ${item.Pathologies}
                	</a>`,
              },
            });
                
                 } else {
   				 return createElement('div', {
              		dangerouslySetInnerHTML: {
                		__html: `<a class="algolia-item" href="/pathologies/${item.Slug}">

                  		${item.Pathologies}
                  		<img src=${item.Logo_for_finder_URL} alt="" >

                	</a>`,
              },
            });
  } 
                
          },
          noResults() {
            return 'Cette situation clinique n`est pas encore disponible.';
          },
        },
      }, ];
    },
    navigator: {
      navigate({
        itemUrl
      }) {
        window.location.assign(itemUrl);
      },
      navigateNewTab({
        itemUrl
      }) {
        const windowReference = window.open(itemUrl, '_blank', 'noopener');

        if (windowReference) {
          windowReference.focus();
        }
      },
      navigateNewWindow({
        itemUrl
      }) {
        window.open(itemUrl, '_blank', 'noopener');
      },
    },
  });

  $('#home-autocomplete').length && autocomplete({
    container: '#home-autocomplete',
    plugins: [algoliaInsightsPlugin],
    placeholder: 'Rechercher une pathologie...',
    debug: false,
    defaultActiveItemId: 0,
    detachedMediaQuery: 'none',
    getSources() {
      return [{
        getItems({
          query
        }) {
          return getAlgoliaResults({
            searchClient,
            queries: [{
              indexName: 'pathologies',
              query,
              params: {
                  clickAnalytics: true,
                },
            }, ],
          });
        },
        getItemUrl({
          item
        }) {
          const path = '/pathologies/'
          return path + item.Slug
        },
        templates: {
          item({
            item,
            createElement
          }) {
            	
              if (item.gratos=='TRUE') {

           		 return createElement('div', {
              	dangerouslySetInnerHTML: {
                __html: `<a class="algolia-item" href="/pathologies/${item.Slug}">

                ${item.Pathologies}
                	</a>`,
              },
            });
                
                 } else {
   				 return createElement('div', {
              		dangerouslySetInnerHTML: {
                		__html: `<a class="algolia-item" href="/pathologies/${item.Slug}">

                  		${item.Pathologies}
                  		<img src=${item.Logo_for_finder_URL} alt="" >

                	</a>`,
              },
            });
  } 
                
          },
          noResults() {
            return 'Cette situation clinique n`est pas encore disponible.';
          },
        },
      }, ];
    },
    navigator: {
      navigate({
        itemUrl
      }) {
        window.location.assign(itemUrl);
      },
      navigateNewTab({
        itemUrl
      }) {
        const windowReference = window.open(itemUrl, '_blank', 'noopener');

        if (windowReference) {
          windowReference.focus();
        }
      },
      navigateNewWindow({
        itemUrl
      }) {
        window.open(itemUrl, '_blank', 'noopener');
      },
    },
  });
} 

function dateFormat(inputDate, format) {
    //parse the input date
    const date = new Date(inputDate);

    //extract the parts of the date
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();    

    //replace the month
    format = format.replace("MM", month.toString().padStart(2,"0"));        

    //replace the year
    if (format.indexOf("yyyy") > -1) {
        format = format.replace("yyyy", year.toString());
    } else if (format.indexOf("yy") > -1) {
        format = format.replace("yy", year.toString().substr(2,2));
    }

    //replace the day
    format = format.replace("dd", day.toString().padStart(2,"0"));

    return format;
}
$(document).ready(function(){
  $('.togglebtn').one('click', function () {
      var iframeSrc = $(this).parents('.w-dropdown').find('.iframe-src').text();
      $(this).parents('.w-dropdown').find('.iframe-src').after('<iframe class="iframe-box" src="'+iframeSrc+'" loading="lazy" data-hj-allow-iframe="" width="100%" height="800" frameborder="0"></iframe>');
  });
  $(document).on('click', '.openframe', function () {
      var getFSrc = $(this).next().find('.iframe-src').text();
      $(this).next().find('iframe').attr('src', getFSrc);
      console.log(getFSrc);
  });
  
 

  
});
  
