import { CONFIG } from "/config.js";

let lastRequestId = 0;
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch") && changeInfo.status === 'loading') {
    chrome.storage.local.remove("captions_list");
    const queryParameters = tab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);

    const videoId = urlParameters.get("v");

    if (videoId) {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      lastRequestId++;
      const currentRequestId = lastRequestId;

      fetch(`${CONFIG.API_BASE_URL}/captions/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Charset': 'utf-8'
        },
        body: JSON.stringify({ url: videoUrl }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (currentRequestId === lastRequestId) {
            chrome.storage.local.remove("currentDictionaryName");
            chrome.tabs.sendMessage(tabId, {
              type: "NEW",
              captions_list: data,
              video_id: videoId
            })
          }
        })
        .catch((error) => console.error("Error al obtener captions:", error));
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRANSLATE_SELECTION") {
    const { selectedText, segments, src_language, target_language } = message.payload;

    fetch(`${CONFIG.API_BASE_URL}/captions/getTranslated`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept-Charset': 'utf-8'
        },
        body: JSON.stringify({
            selectedText,
            segments,
            src_language,
            target_language
        })
    })
    .then(response => response.json())
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
        console.error("Error al obtener traducción: ", error);
        sendResponse({ success: false, error });
    });

    return true;

  } else if (message.type === "PUSH_DICTIONARY") {
    const { dictionary, user, token, videoId, dictionaryName, originalLanguage, translatedLanguage } = message.payload;

    fetch(`${CONFIG.API_BASE_URL}/dictionary/post`, { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',  
        'Authorization': `Bearer ${token}`  
    },
      body: JSON.stringify({
        dictionary, 
        user,
        videoId,
        dictionaryName,
        originalLanguage,   
        translatedLanguage
      })
    })
    .then(response => response.json())
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error("Error al enviar el diccionario");
      sendResponse({ success: false, error });
    });

    return true;

  } 

});


