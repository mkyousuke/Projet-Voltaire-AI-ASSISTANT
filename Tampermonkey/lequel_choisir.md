# 🧠 Choix des Modèles et Versions du Script "Projet Voltaire Assistant" 📄

Ce document décrit les différentes versions du script "Projet Voltaire Assistant" disponibles, basées sur différents modèles d'IA Gemini. Chaque version offre un compromis différent en termes de performance, de vitesse, de coût potentiel (utilisation de tokens API) et de capacités de raisonnement. 🧩

## 🗂️ Scripts Disponibles

Actuellement, quatre versions principales du script sont proposées pour s'adapter à vos besoins :

1.  `version_gemini-2.0-flash-001.user.js` (Rapide et économique)
2.  `version_gemini-2.5-flash-preview-04-17.user.js` (Équilibrée)
3.  `version_gemini-3-flash-preview.user.js` (Nouvelle référence : Ultra-rapide et intelligent)
4.  `version_gemini-3-flash-preview_thinking.user.js` (L'Expert : Raisonnement profond activé)

---

### 1. 💨 `version_gemini-2.0-flash-001.user.js`

* **🤖 Modèle Gemini Utilisé :** `gemini-2.0-flash-001`
    * **⚙️ Caractéristiques Générales :** Il s'agit d'un modèle de la famille "Flash" de Google, optimisé pour la rapidité et l'efficacité. Il est conçu pour des tâches qui nécessitent des réponses rapides avec un bon niveau de performance, tout en étant plus économique en termes de consommation de ressources API par rapport aux modèles plus grands.
    * **▶️ Comportement dans ce script :** Le script utilise ce modèle de manière standard. Les appels à l'API sont configurés pour des réponses concises et rapides, sans budget de réflexion spécifique.

* **🎯 Pourquoi choisir cette version ?**
    * **⚡ Vitesse :** Si la rapidité de la réponse de l'assistant est votre priorité absolue.
    * **💰 Économie de tokens :** Si vous souhaitez minimiser les coûts ou rester largement dans le quota gratuit.
    * **🛡️ Stabilité :** Un modèle éprouvé et stable.

---

### 2. 💡 `version_gemini-2.5-flash-preview-04-17.user.js`

* **🤖 Modèle Gemini Utilisé :** `gemini-2.5-flash-preview-04-17`
    * **⚙️ Caractéristiques Générales :** Une évolution du modèle Flash, intégrant des améliorations dans la compréhension. Bien que ce modèle puisse "réfléchir", cette version du script l'utilise en mode standard pour garder une bonne réactivité.
    * **▶️ Comportement dans ce script :** Cette version est configurée avec un **budget de réflexion (`thinkingBudget`) réglé à `0`**. Vous bénéficiez de l'intelligence du 2.5 sans la latence du processus de réflexion complet.

* **🎯 Pourquoi choisir cette version ?**
    * **⚖️ Équilibre :** Un bon compromis entre les capacités améliorées du modèle 2.5 et la rapidité d'exécution.
    * **🌟 Mise à niveau douce :** Si vous trouvez le 2.0 un peu juste, mais que vous ne voulez pas consommer trop de tokens avec les versions "Thinking".

---

### 3. 🚀 `version_gemini-3.0-flash-preview.user.js`

* **🤖 Modèle Gemini Utilisé :** `gemini-3.0-flash-preview`
    * **⚙️ Caractéristiques Générales :** Le tout dernier modèle "Frontier" de Google. Il offre des performances de pointe ("State of the Art") avec une latence extrêmement faible. Il est intrinsèquement plus intelligent que les versions 2.0 et 2.5.
    * **▶️ Comportement dans ce script :** Utilisation standard du modèle 3.0. C'est la version "tout-terrain" par excellence : très rapide et très compétente.

* **🎯 Pourquoi choisir cette version ?**
    * **🏆 Performance Générale :** C'est probablement le meilleur choix par défaut aujourd'hui.
    * **⚡ Vitesse & Intelligence :** Ne fait aucun compromis entre la rapidité d'affichage et la qualité de l'analyse.
    * **🆕 Technologie de Pointe :** Pour utiliser la dernière innovation disponible.

---

### 4. 🧠 `version_gemini-3.0-flash-preview_thinking.user.js` (Recommandé pour l'expertise)

* **🤖 Modèle Gemini Utilisé :** `gemini-3.0-flash-preview` (avec `thinkingConfig`)
    * **⚙️ Caractéristiques Générales :** Cette version exploite la capacité de "Deep Reasoning" (raisonnement profond) du modèle 3.0. Avant de répondre, l'IA prend un temps pour "réfléchir", analyser la structure de la phrase, vérifier les règles grammaticales complexes et valider son hypothèse.
    * **▶️ Comportement dans ce script :**
        * **Thinking Budget Activé :** Le script alloue un budget de tokens dédié à la réflexion.
        * **Analyse Renforcée :** Idéal pour les phrases pièges, les accords subtils ou les règles obscures où les autres modèles pourraient hésiter.
        * **Priorisation des règles apprises :** Intègre et réfléchit activement sur vos règles mémorisées.

* **🎯 Pourquoi choisir cette version ?**
    * **⭐ Précision Maximale :** Si vous voulez la meilleure analyse possible, quitte à attendre une demi-seconde de plus.
    * **🧩 Cas Complexes :** Indispensable pour les niveaux supérieurs du Projet Voltaire (Supérieur, Excellence) où les pièges sont nombreux.
    * **🔄 Remplaçant du 2.5 Thinking :** Cette version remplace l'ancienne "2.5 Thinking" en étant plus rapide et plus intelligente.

---

**📢 Note sur les versions :**
Les modèles sont en constante évolution. Si vous utilisez une version "preview", gardez à l'esprit que Google peut la mettre à jour régulièrement. La version **3.0 Flash Thinking** est actuellement la recommandation pour obtenir les résultats les plus fiables sur les exercices difficiles. 👍