import { CONFIG } from "./config.js";
import { getActiveTabURL } from './utils.js';

const addNewTranslation = (dictionaryElement, translation, currentVideo) => {
    const newTranslationElement = document.createElement("div");
    const originalElement = document.createElement("div");
    const translatedElement = document.createElement("div");
    //const scoreElement = document.createElement("div");
    const controlsElement = document.createElement("div");

    originalElement.className = "translation-original";
    translatedElement.className = "translation-translated";
    //scoreElement.className = "translation-score";
    controlsElement.className = "translation-controls";

    originalElement.textContent = translation.original.replace(
        /^\w+/,
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    translatedElement.textContent = translation.translated.replace(
        /^\w+/,
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    //scoreElement.textContent = translation.score;

    setTranslationAttributes("play", onPlay, controlsElement);
    setTranslationAttributes("delete", (e) => onDelete(e, currentVideo), controlsElement);

    newTranslationElement.id = `translation-${translation.time}-${originalElement.textContent}`;
    newTranslationElement.className = "translation";
    newTranslationElement.setAttribute("timestamp", translation.time);

    newTranslationElement.appendChild(controlsElement);
    newTranslationElement.appendChild(originalElement);
    newTranslationElement.appendChild(translatedElement);
    //newTranslationElement.appendChild(scoreElement);
    dictionaryElement.appendChild(newTranslationElement);
};

const onPlay = async e => {
    const translationElement = e.target.closest('.translation'); 
    const translationTime = translationElement.getAttribute("timestamp");
    const activeTab = await getActiveTabURL();

    chrome.tabs.sendMessage(activeTab.id, {
        type: "PLAY",
        value: translationTime
    })
};

const onDelete = async (e, currentVideo) => {
    const translationElement = e.target.closest('.translation'); 
    const translationTime = translationElement.getAttribute("timestamp");
    const originalText = translationElement.querySelector('.translation-original').textContent;
    const activeTab = await getActiveTabURL();
    const translationElementToDelete = document.getElementById("translation-" + translationTime + "-" + originalText);

    if (translationElementToDelete) {
        translationElementToDelete.parentNode.removeChild(translationElementToDelete);
    } else {
        console.log("No se encontró el elemento a eliminar");
    }

    chrome.tabs.sendMessage(activeTab.id, {
        type: "DELETE",
        valueTime: translationTime,
        valueText: originalText.trim().toLowerCase()
    }, response => {
        const pushElement = document.getElementsByClassName("push-button")[0];
        if (pushElement && pushElement.style.display === "block") { 
            chrome.storage.sync.get(["videoStatus"], (data) => {
                let videoStatus = data.videoStatus ? JSON.parse(data.videoStatus) : [];
                const videoEntry = videoStatus.find(item => Object.keys(item)[0] === currentVideo);
                if (videoEntry) {
                    const draftStatus = document.getElementsByClassName("draft-status")[0];
                    draftStatus.style.display = "block";
                }
            });
        }
    });
};

const setTranslationAttributes =  (src, eventListener, controlParentElement) => {
    const controlElement = document.createElement("img");

    controlElement.src = "assets/" + src + ".png";
    controlElement.title = src;
    controlElement.className = "translation-" + src;
    controlElement.addEventListener("click", eventListener);
    controlParentElement.appendChild(controlElement)
};

const viewDictionary = (currentDictionary=[], currentVideo, currentDictionaryName) => {
    const dictionaryElement = document.getElementById("dictionary");
    dictionaryElement.innerHTML = "";

    if (currentDictionary.length > 0){
        const dictionaryNameElement = document.createElement("input");
        dictionaryNameElement.className = "dictionary-name";
        dictionaryNameElement.value = currentDictionaryName ? currentDictionaryName : "Dictionary " + currentVideo;
        dictionaryNameElement.style.marginBottom = "20px";
        dictionaryNameElement.style.color = "#D6BD98";
        dictionaryNameElement.style.fontWeight = "bold";
        dictionaryNameElement.style.fontSize = "19px";
        dictionaryNameElement.style.border = "none";
        dictionaryNameElement.style.backgroundColor = "transparent";
        dictionaryNameElement.style.transition = "all 0.3s ease"; 
        dictionaryNameElement.style.padding = "5px"; 
        dictionaryNameElement.style.textAlign = "center"; 

        dictionaryNameElement.onmouseover = () => {
            dictionaryNameElement.style.backgroundColor = "#677D6A"; 
        };

        dictionaryNameElement.onmouseout = () => {
            dictionaryNameElement.style.backgroundColor = "transparent"; 
        };

        dictionaryNameElement.onblur = () => {
            if (!dictionaryNameElement.value.trim()) {
                dictionaryNameElement.value = "Dictionary " + currentVideo; 
            }
        };

        dictionaryNameElement.oninput = () => {
            chrome.storage.sync.get(["videoStatus"], async (data) => {
                let videoStatus = data.videoStatus ? JSON.parse(data.videoStatus) : [];

                console.log("videoStatus: ", videoStatus)
        
                const activeTab = await getActiveTabURL();
                const queryParameters = activeTab.url.split("?")[1];
                const urlParameters = new URLSearchParams(queryParameters);
                const currentVideo = urlParameters.get("v");
        
                const videoEntry = videoStatus.find(item => Object.keys(item)[0] === currentVideo);
        
                if (videoEntry) {
                    videoEntry[currentVideo] = true; 
                    const draftStatus = document.getElementsByClassName("draft-status")[0];
                    draftStatus.style.display = "block"; 
                }
            });
        };

        dictionaryElement.appendChild(dictionaryNameElement);

        for (let i = 0; i < currentDictionary.length; i++){
            const translation = currentDictionary[i];
            addNewTranslation(dictionaryElement, translation, currentVideo);
        }
    } else{
        dictionaryElement.innerHTML = '<i class="empty-dictionary">No dictionary to show</i>'
    }
};

const viewLogin = () => {
    const dinamicontent = document.getElementsByClassName("dinamicontent")[0];
    
    chrome.storage.local.get('authToken', (result) => {
        const isLogged = result.authToken ? true : false; 

        const loginForm =   '<div class="login-form-div"><h2 class="form-login-title">Login</h2>' + 
                            '<form class="login-form">' +
                            '    <input type="email" id="email" name="email" placeholder="Email..." required />' +
                            '    <input type="password" id="password" name="password" placeholder="Password..." required minlength="8" maxlength="12"/>' +
                            '    <div class="button-group">' +
                            '       <button type="submit" id="login-button">Go!</button>' +
                            '       <div class="register-button" id="register-button">Register</div>' +
                            '    </div>' +
                            '</form></div>';

        const googleLoginForm = '<button id="google-login">Continue with Google</button>' + 
                                '<div id="google-modal" style="display: none;"></div>';

        const registerForm = '<div class="register-form-div"><h2 class="form-register-title">Register</h2>' + 
                            '<form class="register-form">' +
                            '    <input type="email" id="registerEmail" name="email" placeholder="Email..." required />' +
                            '    <input type="name" id="name" name="name" placeholder="Name..." required />' +
                            '    <input type="password" id="registerPassword" name="password" placeholder="Password..." required minlength="8" maxlength="12"/>' +
                            '    <input type="password" id="repeatPassword" name="repeatPassword" placeholder="Repeat password..." required minlength="8" maxlength="12"/>' +
                            '    <div class="button-group">' +
                            '       <button type="submit" id="register-button-submit">Go!</button>' +
                            '       <div class="back-button" id="back-button">Back</div>' +
                            '    </div>' +
                            '</form></div>';

        dinamicontent.innerHTML = isLogged ? 
            '<button id="logout-button">Logout</button>' + 
            '<div class="logged-user">User logged successfully</div>': 
            '<div class="forms-login">' + loginForm + registerForm + googleLoginForm + '</div>';

        if (!isLogged) {
            document.getElementById('google-login').addEventListener('click', () => {
                const loginUrl = `${CONFIG.AUTH_BASE_URL}/google`; 
                chrome.windows.create({
                    url: loginUrl,
                    type: 'popup', 
                    width: 600,
                    height: 500,
                }, (window) => {
                    chrome.webNavigation.onCompleted.addListener((details) => {
                        if (details.tabId && details.url.includes('/auth/success') && details.url.includes('token=') && details.url.includes('user=')) {
                            const url = new URL(details.url);
                            const token = url.searchParams.get('token');
                            const user = url.searchParams.get('user');

                            if (token && user) {
                                chrome.storage.local.set({ authToken: token, currentUserEmail: user, isGoogleUser: true });
                                chrome.windows.remove(window.id);
                                viewLogin(); 
                            } else {
                                console.error('No se pudo obtener el token o usuario de la URL.');
                            }
                        }

                    });
                });
            });

            document.getElementById('register-button').addEventListener('click', () => {
                const registerForm = document.querySelector('.register-form-div'); 
                const loginForm = document.querySelector('.login-form-div'); 
            
                if (registerForm && loginForm) {
                    registerForm.style.display = "block";
                    loginForm.style.display = "none";
                } else {
                    console.error('No se encontraron los formularios de registro o login.');
                }
            });

            document.getElementById('back-button').addEventListener('click', () => {
                const registerForm = document.querySelector('.register-form-div'); 
                const loginForm = document.querySelector('.login-form-div'); 
            
                if (registerForm && loginForm) {
                    registerForm.style.display = "none";
                    loginForm.style.display = "block";
                } else {
                    console.error('No se encontraron los formularios de registro o login.');
                }
            });

            document.querySelector('.login-form').addEventListener('submit', async (event) => {
                event.preventDefault(); 
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                try {
                    
                    const response = await fetch(`${CONFIG.API_BASE_URL}/users/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password }),
                    });

                    if (!response.ok) {
                        const { message } = await response.json();
                        showModal(message);
                        return false;
                    }
            
                    const { token, user } = await response.json();
                    
                    chrome.storage.local.set({ authToken: token, currentUserEmail: user, isGoogleUser: false });

                    showModal("User logged!");
                    viewLogin();

                } catch (error) {
                    console.error('Error logging the user: ', error);
                }

            });

            document.querySelector('.register-form').addEventListener('submit', async (event) => {
                event.preventDefault(); 

                const email = document.getElementById('registerEmail').value;
                const name = document.getElementById('name').value;
                const password = document.getElementById('registerPassword').value;
                const repeatPassword = document.getElementById('repeatPassword').value;

                if (password != repeatPassword) {
                    showModal("Passwords do not match");
                    return false;
                }

                try {
                    const response = await fetch(`${CONFIG.API_BASE_URL}/users/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, name, password }),
                    });

                    console.log("Response: ", response);

                    if (!response.ok) {
                        const { message } = await response.json();
                        showModal(message);
                        return false;
                    }
                                
                    showModal("User registered, login is ready");
                    viewLogin();

                } catch (error) {
                    console.error("Error registering the user: ", error);
                }
                
            });
            
        } else { 
            chrome.storage.local.get(['authToken','currentUserEmail', 'isGoogleUser'], (result) => {

                document.getElementById('logout-button').addEventListener('click', () => {
                    chrome.storage.local.remove(['authToken', 'currentUserEmail', 'isGoogleUser'], () => {
                        console.log("Datos de usuario eliminados del almacenamiento local");
                    });
                    if (result.isGoogleUser) {
                        fetch(`${CONFIG.AUTH_BASE_URL}/logout`)
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(`Error en el logout: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then((data) => {
                            viewLogin();
                            if (data.redirectUrl) {
                                window.location.href = data.redirectUrl;
                            } else {
                                console.warn("No se proporcionó una URL de redirección en la respuesta");
                            }
                        })
                        .catch((err) => console.error('Error al cerrar sesión:', err));
                    } else {
                        viewLogin();
                    }
                    
                });
            })
        }
    });
}

function showModal (message) {
    const modal = document.createElement('div');
    modal.className = 'popup-modal';
    modal.textContent = message ? message : "Unknown error";

    const popupBody = document.getElementsByClassName("popup-body")[0];
    popupBody.appendChild(modal);

    setTimeout(() => {
        let opacity = 0.85;
        const fadeInterval = setInterval(() => {
            if (opacity > 0) {
                opacity -= 0.05;
                modal.style.opacity = opacity;
            } else {
                clearInterval(fadeInterval);
                modal.remove();
            }
        }, 50)
    }, 1250)

}

document.addEventListener("DOMContentLoaded", async () => {
    const activeTab = await getActiveTabURL();
    const queryParameters = activeTab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);
    let showLogin = false;
    const dinamicontent = document.getElementsByClassName("dinamicontent")[0];

    const currentVideo = urlParameters.get("v");

    const header = document.getElementsByClassName("popup-header")[0];

    const pushElement = document.createElement("button");
    pushElement.className = "push-button";

    const imgElement = document.createElement("img");
    imgElement.src = "assets/push-dictionary.png"; 
    imgElement.alt = "Push the disctionary here"; 
    imgElement.style.width = "20px"; 
    imgElement.style.height = "auto";
    pushElement.style.display = "none";

    pushElement.appendChild(imgElement);
    header.appendChild(pushElement);

    const draftStatus = document.createElement("div");
    draftStatus.className = "draft-status";
    draftStatus.title = "The dictionary is in draft status";

    draftStatus.style.display = "none";

    header.appendChild(draftStatus);

    chrome.storage.sync.get(["videoStatus"], (data) => {
        let videoStatus = data.videoStatus ? JSON.parse(data.videoStatus) : [];

        const videoEntry = videoStatus.find(item => Object.keys(item)[0] === currentVideo);

        if (videoEntry && videoEntry[currentVideo] === true) {
            draftStatus.style.display = "block";
        }
    });

    chrome.storage.local.get('authToken', (result) => {
        let textContentLogin = result.authToken ? "Logout" : "Login"; 

        const loginElement = document.createElement("div");
        loginElement.className = "login-div";
        const loginTitle = document.createElement("p");
        loginTitle.className = "login-title";

        loginTitle.textContent = showLogin ? "Back" : textContentLogin; 
        loginElement.appendChild(loginTitle);
        header.appendChild(loginElement);

        loginElement.addEventListener("click", () => {
            chrome.storage.local.get('authToken', (result) => {
                textContentLogin = result.authToken ? "Logout" : "Login";

                showLogin = !showLogin;
                loginTitle.textContent = showLogin ? "Back" : textContentLogin;
                if (showLogin) {
                    pushElement.style.display = 'none';
                    draftStatus.style.display = "none";
                    const dictionaryElement = document.getElementById("dictionary");
                    dictionaryElement.innerHTML = "";
                    viewLogin();
                } else {
                    restoreBodyContent();
                }
            })
            
        });
    });

    const restoreBodyContent = () => {
        dinamicontent.innerHTML = "";
        if (activeTab.url.includes("youtube.com/watch") && currentVideo) {
            chrome.storage.local.get('authToken', (result) => {
                const isLogged = result.authToken ? true : false; 
                if (isLogged) {
                    pushElement.style.display = 'block';

                    chrome.storage.sync.get(["videoStatus"], (data) => {
                        let videoStatus = data.videoStatus ? JSON.parse(data.videoStatus) : [];
                        const videoEntry = videoStatus.find(item => Object.keys(item)[0] === currentVideo);
                        if (videoEntry && videoEntry[currentVideo] === true) {
                            draftStatus.style.display = "block";
                        }
                    });

                } else {
                    pushElement.style.display = 'none';
                    draftStatus.style.display = "none";
                }
            });
            chrome.storage.sync.get([currentVideo], (data) => {
                const currentVideoDictionary = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];
                chrome.storage.local.get('currentDictionaryName', (result) => {
                    viewDictionary(currentVideoDictionary, currentVideo, result.currentDictionaryName);
                })
            });
        } else if (activeTab.url.includes("youtube.com")) {
            pushElement.style.display = 'none';
            draftStatus.style.display = "none";
            dinamicontent.innerHTML = '<div class="not-a-youtube-video">Enter a video to start</div>';
        } else {
            pushElement.style.display = 'none';
            draftStatus.style.display = "none";
            dinamicontent.innerHTML = '<div class="not-a-youtube-page-title">This is not a YouTube video page.</div>';
        }
    };

    restoreBodyContent();

    pushElement.addEventListener("click", () => {
        chrome.storage.sync.get([currentVideo], (data) => {
            const currentVideoDictionary = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];
            
            let currentUser = "";
            let currentToken = "";
            let originalLanguage = "";
            let translatedLanguage = "";
            chrome.storage.local.get(['currentUserEmail', 'authToken', 'originalLanguage', 'translatedLanguage'], (result) => {
                currentUser = result.currentUserEmail;
                currentToken = result.authToken;
                originalLanguage = result.originalLanguage;
                translatedLanguage = result.translatedLanguage;

                const dictionaryNameElement = document.querySelector(".dictionary-name");
                if (!dictionaryNameElement) showModal("Error getting the dictionary name");
                const dictionaryName = dictionaryNameElement.value;
                
                if (currentUser != "" && currentToken != "" && currentVideo) {
                    chrome.runtime.sendMessage({
                        type: "PUSH_DICTIONARY",
                        payload: {
                            dictionary: currentVideoDictionary,
                            user: currentUser,
                            token: currentToken,
                            videoId: currentVideo,
                            dictionaryName: dictionaryName,
                            originalLanguage: originalLanguage, 
                            translatedLanguage: translatedLanguage
                        }
                    }, (response) => {
                        if (response && response.success) {
                            showModal(response.data.message)
                            chrome.storage.local.set({ currentDictionaryName: dictionaryName });

                            const draftStatus = document.getElementsByClassName("draft-status")[0];
                            draftStatus.style.display = "none";
                            chrome.storage.sync.get(["videoStatus"], (data) => {
                                let videoStatus = data.videoStatus ? JSON.parse(data.videoStatus) : [];
                                console.log("videoStatus: ", videoStatus)
    
                                const videoEntry = videoStatus.find(item => Object.keys(item)[0] === currentVideo);
                                if (videoEntry) {
                                    videoEntry[currentVideo] = false; 
                                }
    
                                chrome.storage.sync.set({ videoStatus: JSON.stringify(videoStatus) });
                            });
                        } else {
                            showModal("Error pushing the dictionary")
                        }
                        
                    })
                } else {
                    console.log("Error al obtener el usuario y el token")
                }
                
            })
            
        });
    });

});


