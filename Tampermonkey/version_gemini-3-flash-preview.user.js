// ==UserScript==
// @name         Projet Voltaire Assistant (Gemini 3 Flash)
// @namespace    http://tampermonkey.net/
// @version      1.0 // Ajout de la version 3 de Gemini Flash
// @description  Assiste à plusieurs types d'exercices sur Projet Voltaire avec Gemini 3 Flash.
// @author       mkyousuke & Gemini Pro
// @match        https://www.projet-voltaire.fr/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

    const GEMINI_API_KEY = 'VOTRE_CLE_API_GEMINI_ICI';
    const GEMINI_MODEL_NAME = 'gemini-3-flash-preview';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let indicationBoxes = [];

    function showIndication(message, targetElement = null, isGlobal = false, idSuffix = '') {
        if (isGlobal) {
            removeGlobalIndication();
        }
        const indicationBox = document.createElement('div');
        indicationBox.id = `pv-gemini-indication-${idSuffix || Date.now()}`;
        indicationBox.style.padding = '8px 12px';
        indicationBox.style.backgroundColor = '#e9f5fe';
        indicationBox.style.border = '1px solid #1a73e8';
        indicationBox.style.borderRadius = '5px';
        indicationBox.style.fontFamily = '"Google Sans", Roboto, Arial, sans-serif';
        indicationBox.style.fontSize = '14px';
        indicationBox.style.boxShadow = '0px 1px 3px rgba(0,0,0,0.1)';
        indicationBox.style.zIndex = '10001';
        indicationBox.innerHTML = message;

        if (targetElement && !isGlobal) {
            indicationBox.style.position = 'absolute';
            const rect = targetElement.getBoundingClientRect();
            indicationBox.style.left = `${rect.right + window.scrollX + 10}px`;
            indicationBox.style.top = `${rect.top + window.scrollY + (rect.height / 2) - (indicationBox.offsetHeight / 2)}px`;
            if (targetElement.parentNode && getComputedStyle(targetElement.parentNode).position === 'static') {
                targetElement.parentNode.style.position = 'relative';
            }
            (targetElement.parentNode || document.body).appendChild(indicationBox);
        } else {
            indicationBox.style.position = 'fixed';
            indicationBox.style.bottom = '20px';
            indicationBox.style.left = '20px';
            document.body.appendChild(indicationBox);
        }
        indicationBoxes.push(indicationBox);
    }

    function removeAllIndications() {
        indicationBoxes.forEach(box => {
            if (box && box.parentNode) box.remove();
        });
        indicationBoxes = [];
        document.querySelectorAll('.pointAndClickSpan, .noMistakeButton, .intensiveQuestion button, .rule-details-title').forEach(el => {
            el.style.outline = '';
            el.style.borderWidth = '';
            el.style.boxShadow = '';
        });
    }

    function removeGlobalIndication() {
        const globalBox = indicationBoxes.find(box => box.style.position === 'fixed');
        if (globalBox && globalBox.parentNode) {
            globalBox.remove();
            indicationBoxes = indicationBoxes.filter(b => b !== globalBox);
        }
    }

    async function callGeminiAPI(promptText, temperature = 0.1, maxOutputTokens = 100) {
        if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('VOTRE_CLE')) {
            showIndication("ERREUR : Clé API Gemini non configurée.", null, true, "apierror");
            return Promise.reject("Clé API non configurée");
        }
        console.log(`[PV Gemini Assistant] Prompt envoyé à ${GEMINI_MODEL_NAME}:`, promptText);
        console.log(`[PV Gemini Assistant] Paramètres: temp=${temperature}, maxTokens=${maxOutputTokens}`);

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: GEMINI_API_URL,
                headers: { 'Content-Type': 'application/json', },
                data: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: {
                        temperature: temperature,
                        maxOutputTokens: maxOutputTokens,
                        topK: 1,
                        topP: 0.1,
                        thinkingConfig: {
                            thinkingBudget: 0
                        }
                    }
                }),
                timeout: 45000,
                onload: (response) => {
                    console.log(`[PV Gemini Assistant] Réponse API reçue. Statut: ${response.status}`);
                    if (response.status === 200) {
                        console.log("[PV Gemini Assistant] Réponse BRUTE de l'API (status 200):", response.responseText);
                        try {
                            const jsonResponse = JSON.parse(response.responseText);
                            console.log("[PV Gemini Assistant] Réponse JSON parsée (status 200):", jsonResponse);

                            if (jsonResponse.candidates && jsonResponse.candidates.length > 0 && jsonResponse.candidates[0].finishReason && jsonResponse.candidates[0].finishReason !== "STOP" && jsonResponse.candidates[0].finishReason !== "MAX_TOKENS" && jsonResponse.candidates[0].finishReason !== "OTHER") {
                                console.error(`[PV Gemini Assistant] Génération arrêtée. finishReason: ${jsonResponse.candidates[0].finishReason}. Réponse:`, jsonResponse);
                                if (jsonResponse.promptFeedback && jsonResponse.promptFeedback.blockReason) {
                                     reject(`Réponse Gemini bloquée: ${jsonResponse.promptFeedback.blockReason} (finishReason: ${jsonResponse.candidates[0].finishReason})`);
                                     return;
                                }
                                if (jsonResponse.candidates[0].finishReason === "SAFETY") {
                                    reject(`Réponse Gemini bloquée pour des raisons de sécurité (finishReason: SAFETY).`);
                                    return;
                                }
                                reject(`Génération de texte incomplète: ${jsonResponse.candidates[0].finishReason}`);
                                return;
                            }

                            if (jsonResponse.candidates &&
                                jsonResponse.candidates[0] &&
                                jsonResponse.candidates[0].content &&
                                jsonResponse.candidates[0].content.parts &&
                                jsonResponse.candidates[0].content.parts[0] &&
                                typeof jsonResponse.candidates[0].content.parts[0].text === 'string') {
                                resolve(jsonResponse.candidates[0].content.parts[0].text.trim());
                            } else if (jsonResponse.promptFeedback && jsonResponse.promptFeedback.blockReason) {
                                console.error("[PV Gemini Assistant] Réponse Gemini bloquée (promptFeedback). Feedback:", jsonResponse.promptFeedback);
                                reject(`Réponse Gemini bloquée: ${jsonResponse.promptFeedback.blockReason}`);
                            } else if (jsonResponse.candidates && jsonResponse.candidates[0] && jsonResponse.candidates[0].finishReason === "MAX_TOKENS" && (!jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts)) {
                                console.error("[PV Gemini Assistant] MAX_TOKENS atteint sans contenu 'parts' utilisable. Augmentez maxOutputTokens ou vérifiez le prompt.");
                                reject("MAX_TOKENS atteint sans contenu textuel. Essayez d'augmenter maxOutputTokens.");
                            } else {
                                console.error("[PV Gemini Assistant] Format de réponse Gemini INATTENDU (status 200). Réponse JSON actuelle:", jsonResponse);
                                reject("Format de réponse Gemini inattendu.");
                            }
                        } catch (e) {
                            console.error("[PV Gemini Assistant] Erreur de PARSING de la réponse Gemini (status 200). Erreur:", e);
                            console.error("[PV Gemini Assistant] Réponse brute qui a causé l'erreur de parsing:", response.responseText);
                            reject("Erreur de parsing de la réponse Gemini.");
                        }
                    } else {
                        console.error(`[PV Gemini Assistant] Erreur API Gemini (${GEMINI_MODEL_NAME}) - Statut HTTP: ${response.status}. Réponse brute:`, response.responseText);
                        try {
                            const errorResponse = JSON.parse(response.responseText);
                            reject(`Erreur API Gemini (${GEMINI_MODEL_NAME}): ${response.status} - ${errorResponse.error?.message || response.statusText}`);
                        } catch (e) {
                            reject(`Erreur API Gemini (${GEMINI_MODEL_NAME}): ${response.status} - ${response.statusText}. Impossible de parser la réponse d'erreur.`);
                        }
                    }
                },
                onerror: (error) => {
                    console.error(`[PV Gemini Assistant] Erreur de CONNEXION à l'API Gemini (${GEMINI_MODEL_NAME}). Détails:`, error);
                    reject(`Erreur de connexion à l'API Gemini (${GEMINI_MODEL_NAME}).`);
                },
                ontimeout: () => {
                    console.error(`[PV Gemini Assistant] TIMEOUT de la requête vers l'API Gemini (${GEMINI_MODEL_NAME}).`);
                    reject(`Timeout de la requête vers l'API Gemini (${GEMINI_MODEL_NAME}).`);
                }
            });
        });
    }

    async function processSingleSentenceCorrection() {
        const sentenceElement = document.querySelector('.pointAndClickView .sentence');
        const noMistakeButton = document.querySelector('.pointAndClickView .noMistakeButton');

        if (document.querySelector('.popupPanel.intensivePopup .intensiveQuestion')) {
            console.log("[PV Gemini Assistant] processSingleSentenceCorrection: Annulé, un QCM semble actif.");
            return;
        }

        if (!sentenceElement || !noMistakeButton) {
            console.log("[PV Gemini Assistant] Type 1: Conditions non remplies (sélecteurs spécifiques pour phrase unique non trouvés).");
            return;
        }
        const sentenceText = sentenceElement.textContent.trim();
        if (!sentenceText) return;

        console.log(`[PV Gemini Assistant] Type 1 (Phrase unique) détectée : "${sentenceText}"`);
        showIndication(`Analyse (Phrase unique) en cours avec ${GEMINI_MODEL_NAME}...`, null, true, "singlecorrection");
        const prompt = `Tu es un correcteur grammatical, orthographique, et syntaxique expert de la langue française. Analyse la phrase suivante pour identifier une unique faute (la plus évidente ou la première rencontrée s'il y en a plusieurs). Types de fautes : orthographe, grammaire, conjugaison, accord, typographie, syntaxe. Phrase : "${sentenceText}" Instructions : 1. Si faute, réponds avec le mot/groupe de mots fautif exact. 2. Si correcte, réponds "AUCUNE_FAUTE". Ne fournis aucune explication. Exemples : "Les chat sont joueurs." -> "chat"; "Tout est en ordre." -> "AUCUNE_FAUTE".`;
        try {
            const geminiResponse = await callGeminiAPI(prompt, 0.1, 100);
            if (!geminiResponse && geminiResponse !== "") {
                showIndication("Aucune réponse de Gemini (Phrase unique) ou clé API non configurée.", null, true, "singlecorrection");
                return;
            }
            const normalizedResponseCheck = geminiResponse.toUpperCase().replace(/[\s.]/g, '');
            if (normalizedResponseCheck === "AUCUNE_FAUTE") {
                showIndication(`${GEMINI_MODEL_NAME} suggère : Aucune faute. <br>👉 Cliquez sur 'IL N'Y A PAS DE FAUTE'.`, noMistakeButton, false, "nomistake");
                if(noMistakeButton) { noMistakeButton.style.outline = '3px solid green'; noMistakeButton.style.borderWidth = '3px'; noMistakeButton.style.boxShadow = '0 0 10px green'; }
            } else {
                const wordsToClickElements = Array.from(document.querySelectorAll('.pointAndClickView .pointAndClickSpan'));
                let foundElement = null;
                const cleanGeminiResponse = geminiResponse.replace(/[.,;:!?]$/, '').trim();
                foundElement = wordsToClickElements.find(el => el.textContent.trim() === cleanGeminiResponse);
                if (!foundElement) {
                    const lowerCleanResponse = cleanGeminiResponse.toLowerCase();
                    foundElement = wordsToClickElements.find(el => {
                        const lowerElText = el.textContent.trim().toLowerCase();
                        if (lowerElText.includes(lowerCleanResponse)) return true;
                        if (lowerCleanResponse.includes(lowerElText) && lowerElText.length > 2) return true;
                        return false;
                    });
                }
                 if (!foundElement && cleanGeminiResponse.includes(' ')) {
                    const responseWords = cleanGeminiResponse.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                     for (const span of wordsToClickElements) {
                        const spanTextLower = span.textContent.trim().toLowerCase();
                        if (responseWords.some(rw => spanTextLower.includes(rw))) { foundElement = span; break; }
                    }
                }
                if (foundElement) {
                    showIndication(`${GEMINI_MODEL_NAME} suggère une faute sur/près de : "<b>${geminiResponse}</b>". <br>👉 Cliquez sur le mot/groupe surligné.`, foundElement, false, "faultword");
                    foundElement.style.outline = '3px solid red'; foundElement.style.borderWidth = '3px';  foundElement.style.boxShadow = '0 0 10px red';
                } else {
                    showIndication(`${GEMINI_MODEL_NAME} a indiqué : "<b>${geminiResponse}</b>", mais non trouvé. Vérifiez ou considérez "aucune faute".`, null, true, "faultnotfound");
                }
            }
        } catch (error) {
            showIndication(`Erreur analyse (Phrase unique) : ${error}`, null, true, "singlecorrectionerror");
            console.error("[PV Gemini Assistant] Erreur processSingleSentenceCorrection:", error);
        }
    }

    async function processMultipleChoiceExercise() {
        console.log("[PV Gemini Assistant] processMultipleChoiceExercise DÉCLENCHÉ.");
        const qcmPopup = document.querySelector('.popupPanel.intensivePopup');
        if (!qcmPopup) {
            console.log("[PV Gemini Assistant] Type 2: Popup QCM non trouvé.");
            return;
        }

        const ruleTitleElement = qcmPopup.querySelector('.intensiveRule .rule-details-title');
        let ruleContext = ruleTitleElement ? ruleTitleElement.textContent.trim() : "la règle de grammaire spécifiée";
        console.log(`[PV Gemini Assistant] Type 2 - Règle détectée : ${ruleContext}`);

        const questionItems = qcmPopup.querySelectorAll('.intensiveQuestions .intensiveQuestion');

        if (questionItems.length === 0) {
            console.log("[PV Gemini Assistant] Type 2: Aucun item de question (.intensiveQuestion) trouvé dans le QCM.");
            showIndication("Type 2: Aucun item de question à analyser trouvé. Structure HTML inattendue pour le QCM.", null, true, "multichoicenophrases");
            return;
        }
        console.log(`[PV Gemini Assistant] Type 2: ${questionItems.length} items trouvés. Règle : ${ruleContext}`);
        showIndication(`Analyse (QCM) en cours pour ${questionItems.length} phrases avec ${GEMINI_MODEL_NAME}...`, null, true, "multichoice");

        const understoodButton = qcmPopup.querySelector('button.understoodButton');
        if (understoodButton && understoodButton.style.display !== 'none' && getComputedStyle(understoodButton).visibility !== 'hidden' && getComputedStyle(understoodButton).opacity !== '0') {
            console.log("[PV Gemini Assistant] Type 2: Clic sur le bouton 'J'ai compris'.");
            understoodButton.click();
            await wait(500);
        }

        let phrasesTextArray = [];
        let phraseElementsData = [];

        questionItems.forEach((item, index) => {
            const phraseElement = item.querySelector('.sentence');
            const correctButton = item.querySelector('button.buttonOk');
            const incorrectButton = item.querySelector('button.buttonKo');
            const text = phraseElement ? phraseElement.textContent.trim() : null;

            if (text && correctButton && incorrectButton) {
                phrasesTextArray.push(`${index + 1}. ${text}`);
                phraseElementsData.push({
                    element: item,
                    phrase: text,
                    correctButton: correctButton,
                    incorrectButton: incorrectButton,
                    originalIndex: index
                });
            } else {
                console.warn(`[PV Gemini Assistant] Type 2: Item ${index + 1}: Phrase ou boutons non trouvés dans:`, item);
            }
        });

        if (phrasesTextArray.length === 0) {
            showIndication("Type 2: Aucune phrase à analyser extraite des items QCM.", null, true, "multichoicenophrasesextracted");
            return;
        }

        const prompt = `Tu es un expert en grammaire et orthographe. La question porte sur la règle : "${ruleContext}". Pour chaque phrase numérotée ci-dessous, indique si elle est "CORRECTE" ou "INCORRECTE" selon les règles du français standard et la règle spécifiée.
Phrases :
${phrasesTextArray.join("\n")}
Instructions : Réponds avec un tableau JSON. Chaque objet : {"numero": (entier de 1 à ${phrasesTextArray.length}), "evaluation": ("CORRECTE" ou "INCORRECTE")}. Seulement le tableau JSON. Exemple : [{"numero": 1, "evaluation": "CORRECTE"}, {"numero": 2, "evaluation": "INCORRECTE"}]`;

        try {
            const geminiResponse = await callGeminiAPI(prompt, 0.2, 100 + (50 * phrasesTextArray.length));
            if (!geminiResponse && geminiResponse !== "") {
                showIndication("Aucune réponse de Gemini (QCM) ou clé API non configurée.", null, true, "multichoicenoresponse");
                return;
            }
            let evaluations;
            try {
                const cleanedResponse = geminiResponse.replace(/```json\s*|\s*```/g, '').trim();
                evaluations = JSON.parse(cleanedResponse);
            } catch (e) { console.error("[PV Gemini Assistant] Type 2: Erreur parsing JSON QCM:", e, "Réponse reçue:", geminiResponse); showIndication("Erreur format réponse Gemini (QCM).", null, true, "mcparseerr"); return; }

            if (!Array.isArray(evaluations)) { console.error("[PV Gemini Assistant] Type 2: Réponse QCM non-tableau:", evaluations); showIndication("Format réponse Gemini incorrect (QCM).", null, true, "mcformaterr"); return; }

            evaluations.forEach(eva => {
                const phraseInfo = phraseElementsData.find(p => (p.originalIndex + 1) === eva.numero);
                if (phraseInfo) {
                    const targetButton = eva.evaluation.toUpperCase() === "CORRECTE" ? phraseInfo.correctButton : phraseInfo.incorrectButton;
                    if (targetButton) {
                        showIndication(`Gemini : <b>${eva.evaluation}</b>`, targetButton.parentNode, false, `mc${eva.numero}`);
                        targetButton.style.outline = '3px solid #28a745';
                        targetButton.style.borderWidth = '3px';
                        targetButton.style.boxShadow = '0 0 10px #28a745';
                    }
                }
            });
            showIndication(`Analyse (QCM) terminée. Vérifiez les suggestions.`, null, true, "multichoicedone");
        } catch (error) {
            showIndication(`Erreur analyse (QCM) : ${error}`, null, true, "multichoiceerror");
            console.error("[PV Gemini Assistant] Erreur processMultipleChoiceExercise:", error);
        }
    }

    let currentPath = "";
    let analyzeButton = null;
    let uiUpdateTimeout = null;

    function updateUIForCurrentPage() {
        console.log("[PV Gemini Assistant] updateUIForCurrentPage: Vérification...");

        const qcmPopup = document.querySelector('.popupPanel.intensivePopup .intensiveQuestion');
        const qcmRuleTitle = document.querySelector('.popupPanel.intensivePopup .intensiveRule .rule-details-title');
        const type1Container = document.querySelector('.pointAndClickView');
        const type1Sentence = type1Container ? type1Container.querySelector('.sentence') : null;
        const type1PointAndClickSpans = type1Container ? type1Container.querySelectorAll('.pointAndClickSpan') : [];

        console.log(`  > Détection QCM - Popup Item (.popupPanel.intensivePopup .intensiveQuestion): ${qcmPopup ? 'Trouvé' : 'Non trouvé'}`);
        console.log(`  > Détection QCM - Titre Règle (.popupPanel.intensivePopup .intensiveRule .rule-details-title): ${qcmRuleTitle ? 'Trouvé' : 'Non trouvé'}`);
        console.log(`  > Détection Type 1 - Conteneur (.pointAndClickView): ${type1Container ? 'Trouvé' : 'Non trouvé'}`);
        console.log(`  > Détection Type 1 - Phrase (dans .pointAndClickView): ${type1Sentence ? 'Trouvé' : 'Non trouvé'}`);
        console.log(`  > Détection Type 1 - Mots cliquables (dans .pointAndClickView): ${type1PointAndClickSpans.length > 0 ? `Trouvé (${type1PointAndClickSpans.length})` : 'Non trouvé'}`);

        const isQCM = qcmPopup && qcmRuleTitle;
        const isSingleSentence = type1Container && type1Sentence && type1PointAndClickSpans.length > 0 && !isQCM;

        if (analyzeButton && document.body.contains(analyzeButton)) {
            analyzeButton.remove();
            analyzeButton = null;
        }

        if (isQCM) {
            console.log("[PV Gemini Assistant] Détection: Exercice QCM (Type 2) actif.");
            removeAllIndications();
            analyzeButton = document.createElement('button');
            analyzeButton.id = 'gemini-analyze-button-multi';
            analyzeButton.textContent = 'Analyser QCM (Gemini)';
            analyzeButton.onclick = processMultipleChoiceExercise;
            analyzeButton.style.position = 'fixed'; analyzeButton.style.top = '70px'; analyzeButton.style.right = '20px';
            analyzeButton.style.zIndex = '10000'; analyzeButton.style.padding = '10px 15px';
            analyzeButton.style.backgroundColor = '#34a853'; analyzeButton.style.color = 'white';
            analyzeButton.style.border = 'none'; analyzeButton.style.borderRadius = '8px';
            analyzeButton.style.cursor = 'pointer'; analyzeButton.style.fontFamily = '"Google Sans", Roboto, Arial, sans-serif';
            analyzeButton.style.fontSize = '14px';
            analyzeButton.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)';
            document.body.appendChild(analyzeButton);
            showIndication("Prêt à analyser le QCM.", null, true, "readyMulti");
        } else if (isSingleSentence) {
            console.log("[PV Gemini Assistant] Détection: Exercice Phrase Unique (Type 1) actif.");
            removeAllIndications();
            analyzeButton = document.createElement('button');
            analyzeButton.id = 'gemini-analyze-button-single';
            analyzeButton.textContent = 'Analyser Phrase (Gemini)';
            analyzeButton.onclick = processSingleSentenceCorrection;
            analyzeButton.style.position = 'fixed'; analyzeButton.style.top = '70px'; analyzeButton.style.right = '20px';
            analyzeButton.style.zIndex = '10000'; analyzeButton.style.padding = '10px 15px';
            analyzeButton.style.backgroundColor = '#1a73e8'; analyzeButton.style.color = 'white';
            analyzeButton.style.border = 'none'; analyzeButton.style.borderRadius = '8px';
            analyzeButton.style.cursor = 'pointer'; analyzeButton.style.fontFamily = '"Google Sans", Roboto, Arial, sans-serif';
            analyzeButton.style.fontSize = '14px';
            analyzeButton.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)';
            document.body.appendChild(analyzeButton);
            showIndication("Prêt à analyser la phrase.", null, true, "readySingle");
        } else {
            console.log("[PV Gemini Assistant] Détection: Aucun type d'exercice connu actif pour le moment.");
        }
    }

    const observer = new MutationObserver((mutationsList, observer) => {
        clearTimeout(uiUpdateTimeout);
        uiUpdateTimeout = setTimeout(() => {
            updateUIForCurrentPage();
        }, 750);
    });

    window.addEventListener('load', () => {
        console.log(`[PV Gemini Assistant] Page chargée. Initialisation du script v${GM_info.script.version} (${GEMINI_MODEL_NAME}).`);
        currentPath = window.location.href;
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(updateUIForCurrentPage, 2500);
    });

})();