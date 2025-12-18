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
    const MAX_MEMOIRES_CORRECTIONS = 10;

    let memoireDesCorrections = [];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let globalIndicationBox = null;

    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return str.replace(/[&<>"']/g, function (match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    function ensureGlobalIndicationBox() {
        if (!globalIndicationBox) {
            globalIndicationBox = document.createElement('div');
            globalIndicationBox.id = 'pv-gemini-global-indication';
            globalIndicationBox.style.position = 'fixed';
            globalIndicationBox.style.bottom = '20px';
            globalIndicationBox.style.right = '20px';
            globalIndicationBox.style.zIndex = '10005';
            globalIndicationBox.style.padding = '10px 15px';
            globalIndicationBox.style.backgroundColor = '#e9f5fe';
            globalIndicationBox.style.border = '1px solid #1a73e8';
            globalIndicationBox.style.borderRadius = '5px';
            globalIndicationBox.style.fontFamily = '"Google Sans", Roboto, Arial, sans-serif';
            globalIndicationBox.style.fontSize = '14px';
            globalIndicationBox.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
            globalIndicationBox.style.maxWidth = '450px';
            globalIndicationBox.style.minWidth = '250px';
            globalIndicationBox.style.maxHeight = '400px';
            globalIndicationBox.style.overflowY = 'auto';
            globalIndicationBox.style.display = 'none';
            globalIndicationBox.style.textAlign = 'left';
            document.body.appendChild(globalIndicationBox);
        }
    }

    function showGlobalIndication(message, type = 'info', isHtml = true) {
        ensureGlobalIndicationBox();
        if (isHtml) {
            globalIndicationBox.innerHTML = message;
        } else {
            globalIndicationBox.textContent = message;
        }
        globalIndicationBox.dataset.originalMessage = typeof message === 'string' ? message : '';
        globalIndicationBox.dataset.messageType = type;
        globalIndicationBox.style.display = 'block';

        if (type === 'error') {
            globalIndicationBox.style.backgroundColor = '#fdecea';
            globalIndicationBox.style.borderColor = '#ea4335';
            globalIndicationBox.style.color = '#c5221f';
        } else if (type === 'success') {
            globalIndicationBox.style.backgroundColor = '#e6f4ea';
            globalIndicationBox.style.borderColor = '#34a853';
            globalIndicationBox.style.color = '#1e8e3e';
        } else if (type === 'loading') {
            globalIndicationBox.style.backgroundColor = '#fefcdd';
            globalIndicationBox.style.borderColor = '#fbbc04';
            globalIndicationBox.style.color = '#3c4043';
        } else if (type === 'rules') {
            globalIndicationBox.style.backgroundColor = '#f0f8ff';
            globalIndicationBox.style.borderColor = '#77aaff';
            globalIndicationBox.style.color = '#333';
        }
         else {
            globalIndicationBox.style.backgroundColor = '#e9f5fe';
            globalIndicationBox.style.borderColor = '#1a73e8';
            globalIndicationBox.style.color = '#174ea6';
        }
    }

    function hideGlobalIndication() {
        if (globalIndicationBox) {
            globalIndicationBox.style.display = 'none';
            globalIndicationBox.dataset.messageType = '';
        }
    }

    function removeAllStyling() {
        document.querySelectorAll('.pointAndClickSpan, .noMistakeButton, .intensiveQuestion button').forEach(el => {
            el.style.outline = '';
            el.style.borderWidth = '';
            el.style.boxShadow = '';
        });
    }

    async function callGeminiAPI(promptText, temperature = 0.1, maxOutputTokens = 100, customThinkingBudget = 0, systemInstructionText = null) {
        if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('VOTRE_CLE')) {
            showGlobalIndication("ERREUR : Clé API Gemini non configurée.", "error");
            return Promise.reject("Clé API non configurée");
        }

        let finalSystemInstruction = systemInstructionText || "";
        let memorizedRulesWereAddedToPrompt = false;
        if (memoireDesCorrections.length > 0) {
            let learnedContext = "\n\nIMPORTANT : Prends en compte ces corrections et règles observées précédemment pour améliorer la précision de ta réponse actuelle :\n";
            memoireDesCorrections.forEach((lecon, index) => {
                learnedContext += `Leçon ${index + 1}: Règle: "${lecon.ruleTitle}" (Explication: ${lecon.ruleExplanation}).`;
                if (lecon.type === "phrase_unique_correction") {
                    learnedContext += ` Phrase correcte exemple: "${lecon.correctedSentence}".\n`;
                } else if (lecon.type === "pas_de_faute_confirmation_regle") {
                    learnedContext += ` Cette règle a été confirmée comme s'appliquant à une phrase sans faute (Exemple de phrase concernée: "${lecon.correctedSentence}").\n`;
                } else {
                    learnedContext += "\n";
                }
            });
            finalSystemInstruction = (finalSystemInstruction ? finalSystemInstruction + "\n\n" : "") + learnedContext;
            memorizedRulesWereAddedToPrompt = true;
        }

        if (memorizedRulesWereAddedToPrompt && systemInstructionText && systemInstructionText.includes("INTENSÉMENT sur les 'Leçons'")) {
        } else if (memorizedRulesWereAddedToPrompt) {
             if (globalIndicationBox &&
                globalIndicationBox.style.display === 'block' &&
                globalIndicationBox.dataset.messageType === 'loading' &&
                globalIndicationBox.dataset.originalMessage &&
                globalIndicationBox.innerHTML.includes("Analyse en cours")) {
                const originalLoadingMessage = globalIndicationBox.dataset.originalMessage;
                const currentIsHtml = globalIndicationBox.innerHTML.includes("<br>");
                const newMessage = originalLoadingMessage + "<br><small style='font-style:italic; color:#5f6368;'>Application du contexte des règles mémorisées.</small>";
                showGlobalIndication(newMessage, "loading", currentIsHtml);
            }
        }

        const requestBody = {
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: maxOutputTokens,
                topK: 1,
                topP: 0.1,
                thinkingConfig: {
                    thinkingBudget: customThinkingBudget
                }
            }
        };

        if (finalSystemInstruction) {
            requestBody.systemInstruction = {
                parts: [{ text: finalSystemInstruction }]
            };
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: GEMINI_API_URL,
                headers: { 'Content-Type': 'application/json', },
                data: JSON.stringify(requestBody),
                timeout: 90000,
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const jsonResponse = JSON.parse(response.responseText);
                            if(jsonResponse.usageMetadata) {
                            }
                            if (jsonResponse.candidates && jsonResponse.candidates.length > 0 && jsonResponse.candidates[0].finishReason && jsonResponse.candidates[0].finishReason !== "STOP" && jsonResponse.candidates[0].finishReason !== "MAX_TOKENS" && jsonResponse.candidates[0].finishReason !== "OTHER") {
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
                                reject(`Réponse Gemini bloquée: ${jsonResponse.promptFeedback.blockReason}`);
                            } else if (jsonResponse.candidates && jsonResponse.candidates[0] && jsonResponse.candidates[0].finishReason === "MAX_TOKENS" && (!jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts)) {
                                reject("MAX_TOKENS atteint sans contenu textuel. Essayez d'augmenter maxOutputTokens.");
                            } else {
                                reject("Format de réponse Gemini inattendu.");
                            }
                        } catch (e) {
                            reject("Erreur de parsing de la réponse Gemini.");
                        }
                    } else {
                        try {
                            const errorResponse = JSON.parse(response.responseText);
                            reject(`Erreur API Gemini (${GEMINI_MODEL_NAME}): ${response.status} - ${errorResponse.error?.message || response.statusText}`);
                        } catch (e) {
                            reject(`Erreur API Gemini (${GEMINI_MODEL_NAME}): ${response.status} - ${response.statusText}. Impossible de parser la réponse d'erreur.`);
                        }
                    }
                },
                onerror: (error) => {
                    reject(`Erreur de connexion à l'API Gemini (${GEMINI_MODEL_NAME}).`);
                },
                ontimeout: () => {
                    reject(`Timeout de la requête vers l'API Gemini (${GEMINI_MODEL_NAME}).`);
                }
            });
        });
    }

    async function analyzeSentenceWithFocus(analysisStrength = 'normal') {
        const sentenceElement = document.querySelector('.pointAndClickView .sentence');
        const noMistakeButton = document.querySelector('.pointAndClickView .noMistakeButton');

        if (document.querySelector('.popupPanel.intensivePopup .intensiveQuestion')) {
            return;
        }
        if (!sentenceElement || !noMistakeButton) {
            return;
        }
        const sentenceText = sentenceElement.textContent.trim();
        if (!sentenceText) return;

        let systemInstructionForAPI = `Tu es un correcteur grammatical, orthographique, et syntaxique expert de la langue française.`;
        let loadingMessagePrefix = "Analyse (Phrase unique)";
        let currentThinkingBudget = 512;

        if (analysisStrength === 'enhanced') {
            currentThinkingBudget = 1536;
            loadingMessagePrefix = "Analyse renforcée";
        }

        if (memoireDesCorrections.length > 0) {
             systemInstructionForAPI = `Tu es un assistant expert. Pour l'analyse suivante, concentre-toi INTENSÉMENT sur les 'Leçons' (règles mémorisées) qui te sont fournies dans ton contexte système. Essaie d'identifier si l'une d'elles s'applique directement à la phrase. Ta réponse doit être basée en priorité sur ces leçons. Les règles générales du français s'appliquent aussi. En complément de cela, agis comme un ${systemInstructionForAPI.toLowerCase()}`;
            if (analysisStrength === 'enhanced') {
                loadingMessagePrefix = "Analyse renforcée";
            } else {
                loadingMessagePrefix = "Analyse (Phrase unique)";
            }
        }

        showGlobalIndication(`${loadingMessagePrefix} en cours avec ${GEMINI_MODEL_NAME}...`, "loading", true);

        const prompt = `Analyse la phrase suivante pour identifier une unique faute (la plus évidente ou la première rencontrée s'il y en a plusieurs). Types de fautes : orthographe, grammaire, conjugaison, accord, typographie, syntaxe. Phrase : "${sentenceText}"
Instructions pour le format de réponse :
1. Si une faute est trouvée, réponds avec le mot/groupe de mots fautif exact.
2. IMPORTANT: Si le mot/groupe de mots fautif exact apparaît plusieurs fois dans la phrase, tu DOIS préfixer ta réponse par son numéro d'occurrence en toutes lettres (premier, première, deuxième, troisième, etc.), suivi d'un espace, puis du mot/groupe de mots fautif. Exemple: si la faute est le deuxième mot "erreur" dans la phrase, réponds "deuxième erreur". Si c'est le premier, réponds "premier erreur". Si une seule occurrence ou si ce n'est pas pertinent, réponds juste avec le mot/groupe de mots fautif.
3. Si la phrase est correcte (AUCUNE faute de quelque type que ce soit), réponds UNIQUEMENT avec la chaîne de caractères "AUCUNE_FAUTE".
Ne fournis JAMAIS d'explication ou de commentaire. Exemples de réponse si faute: "chat", "deuxième chat", "la erreurs", "premier les". Exemple si correcte: "AUCUNE_FAUTE".`;

        try {
            const estimatedResponseTokens = 80;
            const singleSentenceMaxOutputTokens = currentThinkingBudget + estimatedResponseTokens + 70;

            const geminiResponse = await callGeminiAPI(prompt, 0.1, singleSentenceMaxOutputTokens, currentThinkingBudget, systemInstructionForAPI);

            if ((!geminiResponse && geminiResponse !== "") || geminiResponse === null || typeof geminiResponse === 'undefined') {
                 showGlobalIndication("Aucune réponse de Gemini ou clé API non configurée.", "error");
                 return;
            }

            const geminiOutputForDisplay = geminiResponse.trim();
            const normalizedResponseCheck = geminiOutputForDisplay.toUpperCase().replace(/[\s.]/g, '');

            if (normalizedResponseCheck === "AUCUNE_FAUTE") {
                showGlobalIndication(`${GEMINI_MODEL_NAME} suggère : Aucune faute. <br>👉 Cliquez sur 'IL N'Y A PAS DE FAUTE'.`, "success", true);
                if(noMistakeButton) { noMistakeButton.style.outline = '3px solid green'; noMistakeButton.style.borderWidth = '3px'; noMistakeButton.style.boxShadow = '0 0 10px green'; }
            } else {
                let occurrence = 1;
                let faultySegmentToSearch = geminiOutputForDisplay;

                const ordinalRegex = /^(premier|première|deuxième|troisième|quatrième|cinquième)\s+(.+)/i;
                const matchOrdinal = geminiOutputForDisplay.match(ordinalRegex);

                if (matchOrdinal) {
                    const ordinalStr = matchOrdinal[1].toLowerCase();
                    faultySegmentToSearch = matchOrdinal[2].trim();
                    switch (ordinalStr) {
                        case 'premier': case 'première': occurrence = 1; break;
                        case 'deuxième': occurrence = 2; break;
                        case 'troisième': occurrence = 3; break;
                        case 'quatrième': occurrence = 4; break;
                        case 'cinquième': occurrence = 5; break;
                    }
                } else {
                    faultySegmentToSearch = faultySegmentToSearch.trim();
                }

                if (!faultySegmentToSearch) {
                     showGlobalIndication(`Réponse de ${GEMINI_MODEL_NAME} non exploitable: "${geminiOutputForDisplay}"`, "warning", true);
                     return;
                }

                const wordsToClickElements = Array.from(document.querySelectorAll('.pointAndClickView .sentence .pointAndClickSpan'));
                let foundElement = null;
                let queryForExactHighlight = faultySegmentToSearch;

                const allExactMatches = wordsToClickElements.filter(el => el.textContent.trim() === queryForExactHighlight);
                if (allExactMatches.length > 0 && occurrence <= allExactMatches.length) {
                    foundElement = allExactMatches[occurrence - 1];
                }

                if (!foundElement) {
                    const allExactMatchesCaseInsensitive = wordsToClickElements.filter(el => el.textContent.trim().toLowerCase() === queryForExactHighlight.toLowerCase());
                    if (allExactMatchesCaseInsensitive.length > 0 && occurrence <= allExactMatchesCaseInsensitive.length) {
                        foundElement = allExactMatchesCaseInsensitive[occurrence - 1];
                    }
                }

                if (!foundElement) {
                    let fuzzyQuery = queryForExactHighlight;
                    if (!/^[.,;:!?]+$/.test(fuzzyQuery) && fuzzyQuery.length > 1) {
                         fuzzyQuery = fuzzyQuery.replace(/[.,;:!?]$/, '').trim();
                    }
                    if (fuzzyQuery === "" && queryForExactHighlight.length > 0) {
                        fuzzyQuery = queryForExactHighlight;
                    }

                    const lowerFuzzyQuery = fuzzyQuery.toLowerCase();
                    let candidates = [];
                    for (let i = 0; i < wordsToClickElements.length; i++) {
                        const el = wordsToClickElements[i];
                        const elTextTrimmed = el.textContent.trim();
                        const lowerElText = elTextTrimmed.toLowerCase();
                        let score = 0;
                        if (lowerElText === "") continue;

                        if (lowerElText.includes(lowerFuzzyQuery)) {
                            score = 90 - (lowerElText.length - lowerFuzzyQuery.length);
                             if (lowerElText === lowerFuzzyQuery) score += 20;
                        } else if (lowerFuzzyQuery.includes(lowerElText)) {
                            if (lowerElText.length > 2) { score = 70 + lowerElText.length; }
                            else if (lowerElText.length > 0 && lowerFuzzyQuery.split(/\s+/).length === 1 && lowerFuzzyQuery.length <= 3) { score = 75; }
                        }
                        if (score > 0) {
                            candidates.push({ element: el, score: score, index: i, text: elTextTrimmed });
                        }
                    }
                    if (candidates.length === 0 && queryForExactHighlight.includes(' ')) {
                        const responseWords = queryForExactHighlight.toLowerCase().split(/\s+/).filter(w => w.length > 0);
                        for (let i = 0; i < wordsToClickElements.length; i++) {
                            const el = wordsToClickElements[i];
                            const spanTextLower = el.textContent.trim().toLowerCase();
                            if (spanTextLower !== "" && responseWords.some(rw => spanTextLower.includes(rw) || rw.includes(spanTextLower))) {
                                candidates.push({element: el, score: 40 + spanTextLower.length, index: i, text: el.textContent.trim()});
                            }
                        }
                    }
                    if (candidates.length > 0) {
                        candidates.sort((a, b) => {
                            if (b.score !== a.score) { return b.score - a.score; }
                            return a.index - b.index;
                        });
                        foundElement = candidates[0].element;
                    }
                }
                let indicationMessage = `${GEMINI_MODEL_NAME} suggère une faute sur/près de&nbsp;: "<b>${escapeHTML(geminiOutputForDisplay)}</b>". <br>👉 Cliquez sur le mot/groupe surligné.`;
                if (foundElement) {
                    showGlobalIndication(indicationMessage, "info", true);
                    foundElement.style.outline = '3px solid red'; foundElement.style.borderWidth = '3px';  foundElement.style.boxShadow = '0 0 10px red';
                } else {
                     showGlobalIndication(`${GEMINI_MODEL_NAME} a indiqué&nbsp;: "<b>${escapeHTML(geminiOutputForDisplay)}</b>", mais non trouvé ou occurrence spécifiée invalide. Vérifiez ou considérez "aucune faute".`, "warning", true);
                }
            }
        } catch (error) {
            showGlobalIndication(`Erreur ${loadingMessagePrefix} : ${error}`, "error", true);
        }
    }

    async function processSingleSentenceCorrection() {
        await analyzeSentenceWithFocus('normal');
    }

    async function analyzeWithEnhancedCapacity() {
        await analyzeSentenceWithFocus('enhanced');
    }

    async function processMultipleChoiceExercise() {
        const qcmPopup = document.querySelector('.popupPanel.intensivePopup');
        if (!qcmPopup) {
            return;
        }

        const ruleTitleElement = qcmPopup.querySelector('.intensiveRule .rule-details-title');
        const ruleTitleText = ruleTitleElement ? ruleTitleElement.textContent.trim() : "";

        let fullRuleDescription = "";
        const ruleExplanationElement = qcmPopup.querySelector('.rule-details-description .explanation');

        if (ruleExplanationElement) {
            fullRuleDescription = ruleExplanationElement.textContent.trim();
        }

        let systemInstructionForRule;
        if (ruleTitleText || fullRuleDescription) {
            let ruleCombinedText = ruleTitleText;
            if (fullRuleDescription) {
                ruleCombinedText += (ruleTitleText ? ' - Description : ' : '') + fullRuleDescription;
            }
            systemInstructionForRule = `Tu es un correcteur grammatical expert. La règle FONDAMENTALE à appliquer pour les phrases suivantes est : "${ruleCombinedText}". Tu dois évaluer chaque phrase UNIQUEMENT en fonction de cette règle et des règles générales du français standard. Sois rigoureux et précis.`;
        } else {
            systemInstructionForRule = `Tu es un correcteur grammatical expert. Applique les règles générales du français standard pour évaluer les phrases suivantes. Sois rigoureux et précis.`;
        }

        const understoodButton = qcmPopup.querySelector('button.understoodButton');
        if (understoodButton && understoodButton.style.display !== 'none' && getComputedStyle(understoodButton).visibility !== 'hidden' && getComputedStyle(understoodButton).opacity !== '0') {
            understoodButton.click();
            await wait(500);
        }

        const questionItems = qcmPopup.querySelectorAll('.intensiveQuestions .intensiveQuestion');
        if (questionItems.length === 0) {
            showGlobalIndication("Type 2: Aucun item de question à analyser trouvé.", "error");
            return;
        }
        showGlobalIndication(`Analyse (QCM) en cours pour ${questionItems.length} phrases avec ${GEMINI_MODEL_NAME}...`, "loading", true);

        let phrasesTextArray = [];
        let phraseElementsData = [];

        questionItems.forEach((item, index) => {
            const phraseElement = item.querySelector('.sentence');
            const correctButton = item.querySelector('button.buttonOk');
            const incorrectButton = item.querySelector('button.buttonKo');
            const text = phraseElement ? phraseElement.textContent.trim() : null;

            if (text && correctButton && incorrectButton) {
                phrasesTextArray.push(`${index + 1}. ${text}`);
                phraseElementsData.push({ element: item, phrase: text, correctButton: correctButton, incorrectButton: incorrectButton, originalIndex: index });
            }
        });

        if (phrasesTextArray.length === 0) {
            showGlobalIndication("Type 2: Aucune phrase à analyser extraite des items QCM.", "error");
            return;
        }

        const userPromptForQCM = `En te basant sur la règle fondamentale fournie précédemment dans l'instruction système, évalue les phrases suivantes.
Phrases :
${phrasesTextArray.join("\n")}
Instructions : Réponds avec un tableau JSON. Chaque objet : {"numero": (entier de 1 à ${phrasesTextArray.length}), "evaluation": ("CORRECTE" ou "INCORRECTE")}. Seulement le tableau JSON. Exemple : [{"numero": 1, "evaluation": "CORRECTE"}, {"numero": 2, "evaluation": "INCORRECTE"}]`;

        try {
            const qcmThinkingBudget = 1024;
            const estimatedResponseTokens = 20 * phrasesTextArray.length;
            const qcmMaxOutputTokens = qcmThinkingBudget + estimatedResponseTokens + 150;
            const geminiResponse = await callGeminiAPI(userPromptForQCM, 0.2, qcmMaxOutputTokens, qcmThinkingBudget, systemInstructionForRule);

            if (!geminiResponse && geminiResponse !== "") {
                showGlobalIndication("Aucune réponse de Gemini (QCM) ou clé API non configurée.", "error");
                return;
            }
            let evaluations;
            try {
                const cleanedResponse = geminiResponse.replace(/```json\s*|\s*```/g, '').trim();
                evaluations = JSON.parse(cleanedResponse);
            } catch (e) { showGlobalIndication("Erreur format réponse Gemini (QCM).", "error"); return; }

            if (!Array.isArray(evaluations)) { showGlobalIndication("Format réponse Gemini incorrect (QCM).", "error"); return; }

            evaluations.forEach(eva => {
                const phraseInfo = phraseElementsData.find(p => (p.originalIndex + 1) === eva.numero);
                if (phraseInfo) {
                    const targetButton = eva.evaluation.toUpperCase() === "CORRECTE" ? phraseInfo.correctButton : phraseInfo.incorrectButton;
                    if (targetButton) {
                        targetButton.style.outline = '3px solid #28a745';
                        targetButton.style.borderWidth = '3px';
                        targetButton.style.boxShadow = '0 0 10px #28a745';
                    }
                }
            });
            showGlobalIndication(`Analyse (QCM) terminée. Vérifiez les suggestions surlignées.`, "success", true);

        } catch (error) {
            showGlobalIndication(`Erreur analyse (QCM) : ${error}`, "error", true);
        }
    }

    function apprendreDesCorrections() {
        const correctionIncorrecteNode = document.querySelector('.pointAndClick.answerDisplayed.incorrect .correctionView .correction');
        const confirmationCorrecteNode = document.querySelector('.pointAndClick.answerDisplayed.correct .answerStatusBar.correct.noMistake');

        let typeDeLecon = null;
        let containerPrincipalNode = null;

        if (correctionIncorrecteNode && correctionIncorrecteNode.offsetParent !== null) {
            typeDeLecon = "phrase_unique_correction";
            containerPrincipalNode = document.querySelector('.pointAndClick.answerDisplayed.incorrect');
        } else if (confirmationCorrecteNode && confirmationCorrecteNode.offsetParent !== null) {
            typeDeLecon = "pas_de_faute_confirmation_regle";
            containerPrincipalNode = document.querySelector('.pointAndClick.answerDisplayed.correct');
        }

        if (typeDeLecon && containerPrincipalNode) {
            const containerRegle = containerPrincipalNode.querySelector('.rule-details');
            let phrasePourLecon = "N/A";

            if (typeDeLecon === "phrase_unique_correction") {
                phrasePourLecon = correctionIncorrecteNode.textContent.trim();
            } else if (typeDeLecon === "pas_de_faute_confirmation_regle") {
                const phraseOriginaleNode = containerPrincipalNode.querySelector('.sentence');
                if (phraseOriginaleNode) {
                    phrasePourLecon = phraseOriginaleNode.textContent.trim();
                } else {
                     phrasePourLecon = "Phrase originale non trouvée pour cette règle confirmée.";
                }
            }

            if (containerRegle) {
                const titreRegle = containerRegle.querySelector('.rule-details-title')?.textContent.trim();
                const explicationRegleNode = containerRegle.querySelector('.rule-details-description .explanation');
                const explicationRegle = explicationRegleNode ? explicationRegleNode.textContent.trim() : "";

                if (titreRegle || explicationRegle) {
                    const nouvelleLecon = {
                        type: typeDeLecon,
                        ruleTitle: titreRegle || (typeDeLecon === "phrase_unique_correction" ? "Règle non titrée (correction)" : "Règle non titrée (pas de faute)"),
                        ruleExplanation: explicationRegle,
                        correctedSentence: phrasePourLecon,
                        timestamp: Date.now()
                    };

                    if (!memoireDesCorrections.some(lecon =>
                        lecon.ruleTitle === nouvelleLecon.ruleTitle &&
                        lecon.ruleExplanation === nouvelleLecon.ruleExplanation &&
                        (lecon.type !== "pas_de_faute_confirmation_regle" || lecon.correctedSentence === nouvelleLecon.correctedSentence)
                    )) {
                        memoireDesCorrections.push(nouvelleLecon);
                        if (memoireDesCorrections.length > MAX_MEMOIRES_CORRECTIONS) {
                            memoireDesCorrections.sort((a, b) => a.timestamp - b.timestamp).shift();
                        }
                        showGlobalIndication("Règle mémorisée", "success");
                        setTimeout(hideGlobalIndication, 2000);
                    }
                }
            }
        }
    }

    async function forcerMemorisationRegle() {
        let leconContextNode = null;
        let typeDeLeconAssocie = "regle_manuelle";
        let phrasePourLeconAssociee = "N/A";

        const incorrectCtx = document.querySelector('.pointAndClick.answerDisplayed.incorrect');
        const correctCtx = document.querySelector('.pointAndClick.answerDisplayed.correct');

        if (incorrectCtx && incorrectCtx.querySelector('.rule-details .rule-details-title')?.offsetParent !== null) {
            leconContextNode = incorrectCtx;
            typeDeLeconAssocie = "phrase_unique_correction";
            const correctionNode = leconContextNode.querySelector('.correctionView .correction');
            phrasePourLeconAssociee = correctionNode ? correctionNode.textContent.trim() : (leconContextNode.querySelector('.sentence')?.textContent.trim() || "N/A");
        } else if (correctCtx && correctCtx.querySelector('.rule-details .rule-details-title')?.offsetParent !== null) {
            leconContextNode = correctCtx;
            typeDeLeconAssocie = "pas_de_faute_confirmation_regle";
            const sentenceNode = leconContextNode.querySelector('.sentence');
            if (sentenceNode) phrasePourLeconAssociee = sentenceNode.textContent.trim();
        }

        if (!leconContextNode) {
            showGlobalIndication("Contexte de règle non trouvé pour mémorisation.", "error");
            return;
        }

        const containerRegle = leconContextNode.querySelector('.rule-details');
        if (!containerRegle) {
            showGlobalIndication("Détails de la règle introuvables.", "error");
            return;
        }

        const titreRegle = containerRegle.querySelector('.rule-details-title')?.textContent.trim();
        const explicationRegleNode = containerRegle.querySelector('.rule-details-description .explanation');
        const explicationRegle = explicationRegleNode ? explicationRegleNode.textContent.trim() : "";

        if (!titreRegle && !explicationRegle) {
            showGlobalIndication("Titre et explication de la règle manquants.", "error");
            return;
        }

        const nouvelleLecon = {
            type: typeDeLeconAssocie,
            ruleTitle: titreRegle || "Règle (sans titre)",
            ruleExplanation: explicationRegle,
            correctedSentence: phrasePourLeconAssociee,
            timestamp: Date.now()
        };

        const initialLength = memoireDesCorrections.length;
        memoireDesCorrections = memoireDesCorrections.filter(lecon =>
            !(lecon.ruleTitle === nouvelleLecon.ruleTitle && lecon.ruleExplanation === nouvelleLecon.ruleExplanation)
        );

        memoireDesCorrections.push(nouvelleLecon);

        if (memoireDesCorrections.length > MAX_MEMOIRES_CORRECTIONS) {
            memoireDesCorrections.sort((a, b) => a.timestamp - b.timestamp).shift();
        }
        showGlobalIndication("Règle mémorisée", "success");
        setTimeout(hideGlobalIndication, 2000);
    }

    function showMemorizedRules() {
        ensureGlobalIndicationBox();

        if (globalIndicationBox.style.display === 'block' && globalIndicationBox.dataset.messageType === 'rules') {
            hideGlobalIndication();
            return;
        }

        if (memoireDesCorrections.length === 0) {
            showGlobalIndication("Aucune règle mémorisée pour le moment.", "info", false);
            return;
        }

        let content = `<h3>Règles Mémorisées (${memoireDesCorrections.length}/${MAX_MEMOIRES_CORRECTIONS}) :</h3><hr>`;
        memoireDesCorrections.forEach((lecon, index) => {
            content += `<div style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc;">`;
            content += `<p><strong>Leçon ${index + 1} (Type: ${escapeHTML(lecon.type)})</strong></p>`;
            content += `<p><strong>Titre :</strong> ${escapeHTML(lecon.ruleTitle)}</p>`;
            if (lecon.ruleExplanation) {
                content += `<p><strong>Explication :</strong> ${escapeHTML(lecon.ruleExplanation)}</p>`;
            }
            if (lecon.correctedSentence && lecon.correctedSentence !== "N/A") {
                 let labelSentence = "Phrase exemple/corrigée";
                 if (lecon.type === "pas_de_faute_confirmation_regle") {
                    labelSentence = "Phrase concernée (pas de faute)";
                 }
                content += `<p><strong>${labelSentence} :</strong> "${escapeHTML(lecon.correctedSentence)}"</p>`;
            }
            content += `</div>`;
        });

        showGlobalIndication(content, 'rules', true);
    }


    let currentPath = "";
    let scriptButtonContainer = null;
    let analyzeButton = null;
    let memorizeRuleButton = null;
    let enhancedAnalyzeButton = null;
    let viewMemorizedRulesButton = null;
    let uiUpdateTimeout = null;

    function updateUIForCurrentPage() {
        apprendreDesCorrections();

        const qcmPopup = document.querySelector('.popupPanel.intensivePopup .intensiveQuestion');
        const qcmRuleTitle = document.querySelector('.popupPanel.intensivePopup .intensiveRule .rule-details-title');
        const type1ContainerNonAnswer = document.querySelector('.pointAndClickView:not(.answerDisplayed)');
        const type1Sentence = type1ContainerNonAnswer ? type1ContainerNonAnswer.querySelector('.sentence') : null;

        const isQCM = qcmPopup && qcmRuleTitle;
        const isSingleSentence = type1ContainerNonAnswer && type1Sentence && (type1ContainerNonAnswer.querySelectorAll('.pointAndClickSpan').length > 0) && !isQCM;

        let ruleIsVisibleForManualMemorization = false;
        const answerDisplayedIncorrect = document.querySelector('.pointAndClick.answerDisplayed.incorrect');
        const answerDisplayedCorrect = document.querySelector('.pointAndClick.answerDisplayed.correct');
        if (answerDisplayedIncorrect && answerDisplayedIncorrect.querySelector('.rule-details .rule-details-title')?.offsetParent !== null) {
            ruleIsVisibleForManualMemorization = true;
        } else if (answerDisplayedCorrect && answerDisplayedCorrect.querySelector('.rule-details .rule-details-title')?.offsetParent !== null) {
            ruleIsVisibleForManualMemorization = true;
        }

        const shouldDisplayMainFunctionButtons = isQCM || isSingleSentence || ruleIsVisibleForManualMemorization;

        if (scriptButtonContainer && document.body.contains(scriptButtonContainer)) {
            while (scriptButtonContainer.firstChild) {
                scriptButtonContainer.removeChild(scriptButtonContainer.firstChild);
            }
        } else if (shouldDisplayMainFunctionButtons || memoireDesCorrections.length >= 0) {
             scriptButtonContainer = document.createElement('div');
             scriptButtonContainer.id = 'pv-gemini-script-buttons-container';
             Object.assign(scriptButtonContainer.style, {
                position: 'fixed', top: '70px', right: '20px', zIndex: '10001',
                display: 'flex', flexDirection: 'column',
                gap: '8px', alignItems: 'flex-end'
            });
            document.body.appendChild(scriptButtonContainer);
        }

        analyzeButton = null;
        memorizeRuleButton = null;
        enhancedAnalyzeButton = null;
        viewMemorizedRulesButton = null;

        if (!scriptButtonContainer && !shouldDisplayMainFunctionButtons) {
             if (globalIndicationBox && globalIndicationBox.dataset.messageType !== 'rules') {
                hideGlobalIndication();
             }
             removeAllStyling();
             return;
        }

        let buttonGroupForRow = document.createElement('div');
        Object.assign(buttonGroupForRow.style, {
            display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', justifyContent: 'flex-end'
        });

        let hasVisibleButtonInRow = false;

        if (isQCM) {
            analyzeButton = document.createElement('button');
            analyzeButton.id = 'gemini-analyze-button-multi';
            analyzeButton.textContent = 'Analyser QCM (Gemini)';
            analyzeButton.onclick = processMultipleChoiceExercise;
            Object.assign(analyzeButton.style, {padding: '10px 15px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: '"Google Sans", Roboto, Arial, sans-serif', fontSize: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'});
            buttonGroupForRow.appendChild(analyzeButton);
            hasVisibleButtonInRow = true;
        } else if (isSingleSentence) {
            analyzeButton = document.createElement('button');
            analyzeButton.id = 'gemini-analyze-button-single';
            analyzeButton.textContent = 'Analyser Phrase (Gemini)';
            analyzeButton.onclick = processSingleSentenceCorrection;
             Object.assign(analyzeButton.style, {padding: '10px 15px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: '"Google Sans", Roboto, Arial, sans-serif', fontSize: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'});
            buttonGroupForRow.appendChild(analyzeButton);
            hasVisibleButtonInRow = true;
        }

        if (isSingleSentence) {
            enhancedAnalyzeButton = document.createElement('button');
            enhancedAnalyzeButton.id = 'gemini-enhanced-analyze-button';
            enhancedAnalyzeButton.textContent = 'Analyse renforcée (consomme plus)';
            Object.assign(enhancedAnalyzeButton.style, {padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: '"Google Sans", Roboto, Arial, sans-serif', fontSize: '13px', boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'});
            enhancedAnalyzeButton.onclick = analyzeWithEnhancedCapacity;
            buttonGroupForRow.appendChild(enhancedAnalyzeButton);
            hasVisibleButtonInRow = true;
        }

        if (ruleIsVisibleForManualMemorization) {
            memorizeRuleButton = document.createElement('button');
            memorizeRuleButton.id = 'gemini-memorize-rule-button';
            memorizeRuleButton.textContent = 'Mémoriser la règle';
            Object.assign(memorizeRuleButton.style, {padding: '8px 12px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: '"Google Sans", Roboto, Arial, sans-serif', fontSize: '13px', boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'});
            memorizeRuleButton.onclick = forcerMemorisationRegle;
            buttonGroupForRow.appendChild(memorizeRuleButton);
            hasVisibleButtonInRow = true;
        }

        if (hasVisibleButtonInRow && scriptButtonContainer) {
            scriptButtonContainer.appendChild(buttonGroupForRow);
        }

        if (scriptButtonContainer) {
            viewMemorizedRulesButton = document.createElement('button');
            viewMemorizedRulesButton.id = 'gemini-view-rules-button';
            viewMemorizedRulesButton.textContent = `Voir Règles (${memoireDesCorrections.length})`;
            viewMemorizedRulesButton.onclick = showMemorizedRules;
            Object.assign(viewMemorizedRulesButton.style, {
                padding: '8px 12px', backgroundColor: '#6c757d',
                color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontFamily: '"Google Sans", Roboto, Arial, sans-serif', fontSize: '13px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
                marginTop: hasVisibleButtonInRow ? '8px' : '0'
            });
            scriptButtonContainer.appendChild(viewMemorizedRulesButton);
        }

        if (scriptButtonContainer && scriptButtonContainer.children.length > 0) {
            if (!document.body.contains(scriptButtonContainer)) {
                 document.body.appendChild(scriptButtonContainer);
            }
            if (analyzeButton || enhancedAnalyzeButton) {
                 if (globalIndicationBox && globalIndicationBox.style.display === 'none') {
                    if (isQCM) showGlobalIndication("Prêt à analyser le QCM.", "info", true);
                    else if (isSingleSentence) showGlobalIndication("Prêt à analyser la phrase.", "info", true);
                }
            }
        } else if (scriptButtonContainer && scriptButtonContainer.children.length === 0) {
            if (document.body.contains(scriptButtonContainer)) {
                 scriptButtonContainer.remove();
                 scriptButtonContainer = null;
            }
            removeAllStyling();
            if (!document.querySelector('.pointAndClick.answerDisplayed') && (globalIndicationBox && globalIndicationBox.dataset.messageType !== 'rules')) {
                 hideGlobalIndication();
            }
        }
    }

    const observer = new MutationObserver((mutationsList, observer) => {
        clearTimeout(uiUpdateTimeout);
        uiUpdateTimeout = setTimeout(() => {
            updateUIForCurrentPage();
        }, 750);
    });

    window.addEventListener('load', () => {
        const scriptVersion = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : 'unknown';
        ensureGlobalIndicationBox();
        currentPath = window.location.href;
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(updateUIForCurrentPage, 1500);
    });

})();