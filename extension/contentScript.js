
let captions_list = {};
let something_selected = false;

(() => {
    let youtubeLeftControls, youtubeCurrentPlayer; 
    let currentVideo = "";
    let currentVideoDictionary = [];
    let hiddeCaptions = false;

    const fetchDictionary = () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get([currentVideo], (obj) => {
                resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
            })
        })
    }

    chrome.runtime.onMessage.addListener((message, sender, response) => {
        if (message.type === "NEW" && message.captions_list) {
            captions_list = message.captions_list;
            chrome.storage.local.set({captions_list})
            chrome.storage.local.set({ originalLanguage: message.captions_list.originalLanguage });
            chrome.storage.local.set({ translatedLanguage: message.captions_list.translatedLanguage });
            currentVideo = message.video_id
            hiddeCaptions = false;
            newVideoLoaded();
        } else if (message.type === "DELETE") {
            chrome.storage.sync.get([currentVideo], (obj) => {
                currentVideoDictionary = JSON.parse(obj[currentVideo]).filter((b) => b.time !== message.valueTime && b.original.trim().toLowerCase() !== message.valueText)
                chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoDictionary)});

                chrome.storage.sync.get(["videoStatus"], (data) => {
                    let videoStatus = data.videoStatus ? JSON.parse(data.videoStatus) : [];
            
                    const videoEntry = videoStatus.find(item => Object.keys(item)[0] === currentVideo);
            
                    if (videoEntry) {
                        videoEntry[currentVideo] = true;
                        const draftStatus = document.getElementsByClassName("draft-status")[0];
                        draftStatus.style.display = "block";
                    }
                }); 
                
                response(currentVideoDictionary);
            })   
            return true;
        } else if (message.type === "PLAY") {
            const timeToPlay = message.value - 4.5;
            youtubeCurrentPlayer.currentTime = timeToPlay > 0 ? timeToPlay : 0.0;
        }
    });

    chrome.storage.local.get(["captions_list"], (data) => {
        if (data.captions_list) {
            captions_list = data.captions_list;
            newVideoLoaded();
        } else {
            console.log("No hay datos previos en el almacenamiento");
        }
    })
    
    const newVideoLoaded = async () => { 

        if (!captions_list || !captions_list.segments) {
            console.error("No se han definido la lista de subtítulos");
            return;
        }

        const segments = captions_list.segments;
        let newOriginalCaptionLine;
        let newTranslatedCaptionLine;
        let start_times = []
        let duration_times = []
        let aux_times = []
        let paused_video = false;

        const handleClickResumeCaptions = async () => {
            
            something_selected = false;

            const captionIndicator = document.getElementsByClassName("ytp-button-caption-indicator")[0];
            captionIndicator.style.display = "none";

            let currentTimeMs = youtubePlayer.currentTime;
            nearestIndex = aux_times.findIndex((time, idx) => 
                time <= currentTimeMs && (idx === aux_times.length - 1 || aux_times[idx + 1] > currentTimeMs)
            );

            window.getSelection().removeAllRanges();
            requestAnimationFrame(showCaptions);
            
        };
        
        const handleSelectedWord = async (e) => {
            e.stopPropagation();
            something_selected = true;

            const captionIndicator = document.getElementsByClassName("ytp-button-caption-indicator")[0];
            captionIndicator.style.display = "block";

            const selection = window.getSelection();            
            const range = selection.getRangeAt(0);
            const containerText = range.startContainer.textContent; 
            const startOffset = range.startOffset;
            const endOffset = range.endOffset;

            const delimiters = [" ", ".", ",", "!", "?", ";", "\n"];

            let validEnd = endOffset;
            while (validEnd < containerText.length && !delimiters.includes(containerText[validEnd])) {
                validEnd++;
            }

            let validStart = startOffset;
            while (validStart > 0 && !delimiters.includes(containerText[validStart - 1])) {
                validStart--;
            }

            range.setStart(range.startContainer, validStart);
            range.setEnd(range.startContainer, validEnd);

            selection.removeAllRanges();
            selection.addRange(range);
        }

        const addNewWordsEventHandler = async (aux_times, segments) => { 
            currentVideoDictionary = await fetchDictionary();
            something_selected = false
            const selection = window.getSelection().toString().split(' ');
            if (selection.length == 1 && selection[0].trim() == "") return;
            const youtubePlayer = document.querySelector('video');
            const currentTime = youtubePlayer.currentTime;

            let currentTimeMs = youtubePlayer.currentTime;
            nearestIndex = aux_times.findIndex((time, idx) => 
                time <= currentTimeMs && (idx === aux_times.length - 1 || aux_times[idx + 1] > currentTimeMs)
            );
            requestAnimationFrame(showCaptions);

            const segmentRange = segments.slice(
                Math.max(0, nearestIndex - 2), 
                Math.min(segments.length, nearestIndex + 3) 
            );

            const selectionString = selection
                .map(select => select)
                .join(" ")
                .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s']/g, ""); 
            const segmentString = segmentRange.map(segment => segment.translated.join(" ")).join(" ");

            const alreadyExist = currentVideoDictionary.some((b) => 
                b.original.trim().toLowerCase() === selectionString.trim().toLowerCase() &&
                b.time === currentTime
            );

            if (alreadyExist) return;

            chrome.runtime.sendMessage({
                type: "TRANSLATE_SELECTION",
                payload: {
                    selectedText: selectionString,
                    segments: segmentString,
                    src_language: captions_list.originalLanguage,
                    target_language: captions_list.translatedLanguage
                }
            }, (response) => {
                if (response && response.success) {
                    const newTranslate = {
                        original: response.data.selected,
                        translated: response.data.translated,
                        score: response.data.score,
                        time: currentTime,
                        segments: segmentString
                    }
                    
                    if (newTranslate.translated && newTranslate.original) {
                        chrome.storage.sync.set({
                            [currentVideo] : JSON.stringify([...currentVideoDictionary, newTranslate].sort((a, b) => a.time - b.time))
                        });
                        chrome.storage.sync.get([currentVideo], (obj) => {
                            resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
                        })
                        chrome.storage.sync.get(["videoStatus"], (data) => {
                            let videoStatus = data.videoStatus ? JSON.parse(data.videoStatus) : []; 
                            const index = videoStatus.findIndex(item => Object.keys(item)[0] === currentVideo);
                            if (index !== -1) {
                                videoStatus[index][currentVideo] = true;
                            } else {
                                videoStatus.push({ [currentVideo]: true });
                            }
                            chrome.storage.sync.set({ videoStatus: JSON.stringify(videoStatus) });
                        });
                        handleClickResumeCaptions();
                    } else {
                        console.log("Error al obtener la traducción.")
                    }
                } else {
                    console.log("Error al obtener la traducción: ", response)
                }
            });
        }
        
        const pushWordBtnExists = document.getElementsByClassName("ytp-button-push-word-btn")[0];
        if (!pushWordBtnExists) {
            const pushWordBtn = document.createElement("img");

            pushWordBtn.src = chrome.runtime.getURL("assets/push.png");
            pushWordBtn.className = "ytp-button-" + "push-word-btn";

            Object.assign(pushWordBtn.style, {
                width: "auto", 
                height: "30px",
                transform: "translateY(35%)",
                marginLeft: "10px",
                cursor: "pointer",
                transition: "transform 0.2s, filter 0.2s", 
            });
            
            pushWordBtn.addEventListener("click", () => {
                pushWordBtn.style.transform = "translateY(40%) scale(0.9)";
                pushWordBtn.style.filter = "brightness(1.2)";
                
                setTimeout(() => {
                    pushWordBtn.style.transform = "translateY(35%) scale(1)";
                    pushWordBtn.style.filter = "brightness(1)";
                }, 200); 
            });
            
            youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
            youtubeCurrentPlayer = document.getElementsByClassName("video-stream")[0];
            
            if (youtubeLeftControls) youtubeLeftControls.appendChild(pushWordBtn);
            pushWordBtn.addEventListener("click", () => addNewWordsEventHandler(aux_times, segments));
        }

        const hiddeBtnExists = document.getElementsByClassName("ytp-button-hidde-caption-btn")[0];
        if (!hiddeBtnExists) {
            const hiddeCaptionBtn = document.createElement("img");

            hiddeCaptionBtn.src = chrome.runtime.getURL("assets/hidde.png");
            hiddeCaptionBtn.className = "ytp-button-" + "hidde-caption-btn";

            Object.assign(hiddeCaptionBtn.style, {
                width: "auto", 
                height: "30px",
                transform: "translateY(35%)",
                marginLeft: "10px",
                cursor: "pointer",
                transition: "transform 0.1s, filter 0.2s", 
            });

            hiddeCaptions = false;
            
            hiddeCaptionBtn.addEventListener("click", () => {
                hiddeCaptions = !hiddeCaptions;
                hiddeCaptionBtn.style.transform = "translateY(40%) scale(0.9)";
                hiddeCaptionBtn.style.filter = "brightness(1.2)";

                hiddeCaptionBtn.src = hiddeCaptions ? chrome.runtime.getURL("assets/unhidde.png") : chrome.runtime.getURL("assets/hidde.png");

                const captionWindow = document.getElementsByClassName("new-caption-window")[0];
                if (captionWindow) {
                    Object.assign(captionWindow.style, {
                        display: hiddeCaptions ? "none" : "flex"
                    })
                }
                
                setTimeout(() => {
                    hiddeCaptionBtn.style.transform = "translateY(35%) scale(1)";
                    hiddeCaptionBtn.style.filter = "brightness(1)";
                }, 200); 
            });
            
            youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
            youtubeCurrentPlayer = document.getElementsByClassName("video-stream")[0];
            
            if (youtubeLeftControls) youtubeLeftControls.appendChild(hiddeCaptionBtn);
        } else {
            hiddeBtnExists.src = hiddeCaptions ? chrome.runtime.getURL("assets/unhidde.png") : chrome.runtime.getURL("assets/hidde.png");
        }

        const newCaptionWindowExists = document.getElementsByClassName("new-caption-window")[0];
        const newCaptionWindow = document.createElement("div");
        if (!newCaptionWindowExists) {

            // Insertar nuevo hijo al .ytp-caption-window-container
            newCaptionWindow.className = "new-caption-window ytp-caption-window-bottom ytp-caption-window-rollup";
            Object.assign(newCaptionWindow.style, {
                position: "absolute",
                textAlign: "center",
                overflow: "hidden",
                width: "60%",
                height: "10%",
                left: "20%",
                bottom: "15%",
                color: "white",
                backgroundColor: "rgba(20, 20, 20, 0.6)",
                zIndex: "1000",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            })

            // Se crea el indicador de pausa de los subtítulos
            const newCaptionIndicator = document.createElement("img");
            newCaptionIndicator.src = chrome.runtime.getURL("assets/pause-indicator.png");
            newCaptionIndicator.className = "ytp-button-" + "caption-indicator";
            newCaptionIndicator.addEventListener("click", () => handleClickResumeCaptions());
            Object.assign(newCaptionIndicator.style, {
                width: "auto", 
                height: "30px",
                position: "absolute",
                right: "10px",
                top: "10px",
                cursor: "pointer",
                display: "none",
            });
            newCaptionWindow.appendChild(newCaptionIndicator);

            // Se crea donde se insertará el texto
            const newCaptionText = document.createElement("span");
            newCaptionText.className = "new-captions-text";
            newCaptionText.addEventListener("mouseup", (e) => handleSelectedWord(e));
            Object.assign(newCaptionText.style, {
                overflowWrap: "normal",
                display: "flex",
                textAlign: "center",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center"
            })

        
            // Donde se insertará los subtítulos del idioma original
            newOriginalCaptionLine = document.createElement("span");
            newOriginalCaptionLine.className = "new-original-caption-line";
            Object.assign(newOriginalCaptionLine.style, {
                display: "block",
                margin: "0 auto",
                color: "rgb(111, 175, 109)",
                fontSize: "1.6em",
                userSelect: "text", 
            })
        
            newCaptionText.appendChild(newOriginalCaptionLine);

            // Donde se insertará los subtítulos del idioma traducido
            newTranslatedCaptionLine = document.createElement("span");
            newTranslatedCaptionLine.className = "new-translated-caption-line";
            Object.assign(newTranslatedCaptionLine.style, {
                display: "block",
                margin: "0 auto",
                color: "white",
                fontSize: "1.4em",
                userSelect: "none",
            })
        
            newCaptionText.appendChild(newTranslatedCaptionLine);

            newCaptionWindow.appendChild(newCaptionText);
        
            // Obtener el contenedor de subtítulos
            const captionWindowContainer = document.getElementsByClassName("ytp-caption-window-container")[0];
            if (captionWindowContainer) {
                captionWindowContainer.style.pointerEvents = "auto"; 
                captionWindowContainer.appendChild(newCaptionWindow);
            }
        }

        if (segments) {
            for(i = 0; i < segments.length; i++) {
                if(i == 0) {
                    start_times.push(segments[i].begin_duration[0]*1000) 
                } else {
                    start_times.push(segments[i].begin_duration[0]*1000 - segments[i-1].begin_duration[0]*1000) 
                }
                duration_times.push(segments[i].begin_duration[1]*1000) 
                aux_times.push(segments[i].begin_duration[0])
            }
        }

        // TODO: revisar si sigue siendo necesario la lógica para la pause y el desplazamiento
        let currentCaptionIndex = -1;
        let firstIndex = false;
        const showCaptions = () => {
            
            if (!segments || paused_video || something_selected) return;

            newCaptionWindow.style.backgroundColor = "rgba(20, 20, 20, 0.6)";

            let currentTimeMs = youtubePlayer.currentTime * 1000;

            let index = segments.findIndex(seg =>
                currentTimeMs >= seg.begin_duration[0] * 1000 &&
                currentTimeMs < (seg.begin_duration[0] + seg.begin_duration[1]) * 1000
            );
                
            if (currentCaptionIndex === -1 && index !== -1) {
                firstIndex = true;
            }

            if (index !== -1 && index !== currentCaptionIndex) {
                
                const currentSegment = firstIndex ? segments[index] : segments[index + 1];

                const currentSegmentOriginal = currentSegment.original.map(line => line.replace(/\n/g, " ")).join(" ");
                const currentSegmentTranslated = currentSegment.translated.map(line => line.replace(/\n/g, " ")).join(" ");

                if (firstIndex) firstIndex = false;

                currentCaptionIndex = index;

                if (!currentSegment.original || !currentSegment.translated) return;

                newOriginalCaptionLine.innerText = currentSegmentOriginal;
                newTranslatedCaptionLine.innerText = currentSegmentTranslated;

            } else if (index === -1) {  
                newOriginalCaptionLine.innerText = "";
                newTranslatedCaptionLine.innerText = "";
                newCaptionWindow.style.backgroundColor = "transparent";
                const captionIndicator = document.getElementsByClassName("ytp-button-caption-indicator")[0];
                captionIndicator.style.display = "none";
                currentCaptionIndex = -1;
            }
            requestAnimationFrame(showCaptions);
        };

        let nearestIndex;
        
        const youtubePlayer = document.querySelector('video');
        if (youtubePlayer) {
            youtubePlayer.addEventListener('play', () => {
                paused_video = false;
                currentTimeMs = youtubePlayer.currentTime;
                nearestIndex = aux_times.findIndex((time, idx) => 
                    time <= currentTimeMs && (idx === aux_times.length - 1 || aux_times[idx + 1] > currentTimeMs)
                );
                requestAnimationFrame(showCaptions);
            })
            youtubePlayer.addEventListener('pause', () => {
                paused_video = true;
            })
        }

        if ((!paused_video || !something_selected) && youtubePlayer) {
            let currentTimeMs = youtubePlayer.currentTime;
            nearestIndex = aux_times.findIndex((time, idx) => 
                time <= currentTimeMs && (idx === aux_times.length - 1 || aux_times[idx + 1] > currentTimeMs)
            );
            requestAnimationFrame(showCaptions);
        }

    };

})();

