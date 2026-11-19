# Décisions prises en cours de route

Complète le cahier des charges. Formulées de façon générale : aucune donnée personnelle (banques, dates, montants).

## Généralités

| Sujet | Décision |
| --- | --- |
| Hébergement | GitHub Pages, déploiement automatique à chaque push sur `main` |
| Premier lancement | Aucun compte créé d'office. Parcours d'accueil : comptes, compte du budget du jour et carte liée, budget par période (rien de prérempli), paie (facultative). Catégories proposées, neutres et modifiables |
| Données existantes | Si des comptes existent ou si les données sont déjà initialisées, rien n'est créé, renommé ni supprimé (test dédié). Pas de migration |
| Montants | Stockés en centimes. Seul l'ajustement de solde est signé ; les autres opérations ont un montant positif, le type donne le sens |
| Carte de crédit | Gérée comme un compte au solde négatif : montant dû = −solde |
| Saisie d'historique (dépenses passées) | Abandonnée |
| Confidentialité du dépôt | Dépôt public. Documentation sans détail personnel ; historique Git réécrit pour retirer ces détails de toutes les anciennes versions |
| Code | Plus d'option « étape » (reste du développement par étapes). `heureRappel` conservé pour le rappel du soir. Saisie rapide et écran des charges découpés en composants, sans changement de comportement |

## Sécurité

| Sujet | Décision |
| --- | --- |
| Code de verrouillage | 6 chiffres, codes trop simples refusés, délai d'attente croissant après 5 erreurs |
| Verrouillage auto | Délai réglable (2 minutes par défaut) |
| Face ID | WebAuthn, clé de l'appareil, vérification de l'utilisateur exigée. Sans serveur : raccourci de déverrouillage, le code reste valable. Bloqué pendant un délai d'attente |
| Sauvegarde chiffrée | AES-GCM 256, clé PBKDF2-SHA256 600 000 itérations, mot de passe de 8 caractères minimum, enregistrée via le menu Partager d'iOS. Le code et Face ID ne sont jamais sauvegardés ; une restauration garde ceux de l'appareil |
| Sauvegarde en un geste | Le bandeau de rappel contient « Sauvegarder maintenant » : feuille avec mot de passe et menu Partager, sans passer par Réglages. Le mot de passe ne vit que dans le formulaire, jamais enregistré (test dédié) |
| Sauvegarde vers un outil de notes | Via le menu Partager d'iOS ; pas d'envoi automatique (il faudrait un serveur et une clé d'accès dans l'app) |
| Tableur en ligne (Google Sheets) | Écarté : pas d'export dédié ni de synchronisation (données financières envoyées hors de l'appareil). L'export CSV reste disponible ; la sauvegarde chiffrée est le seul moyen de restaurer |
| Export CSV | « ; », virgule décimale, UTF-8 avec BOM (Excel en français), montants signés, colonne « Budget du jour » |

## Charges fixes, crédits et revenus

| Sujet | Décision |
| --- | --- |
| Début des prélèvements automatiques | À la création (ou réactivation) d'une récurrence, rien n'est généré jusqu'au jour même inclus : le solde actuel l'inclut déjà |
| Annulation d'un prélèvement | Supprimer l'opération générée ; elle n'est jamais recréée |
| Capital d'un crédit | Capital de référence (saisi) − parts capital des mensualités prélevées depuis ; modifier le capital crée une nouvelle référence. Prévisions arrêtées quand le capital est remboursé |
| Revenu « à confirmer » | Rien n'est crédité automatiquement ; un bandeau demande le montant reçu (prérempli) le jour prévu. Une saisie manuelle proche de la date est rattachée à l'échéance (pas de double compte). « Pas reçu ? » ignore l'échéance |
| Charge payée par carte | Retirée de l'enveloppe comme une charge prélevée sur le compte |
| Virements | Dans la saisie rapide ; montant reçu demandé seulement si les devises diffèrent |
| Liste des charges | Regroupée par compte, puis charges fixes / crédits avec sous-total mensuel ; total par compte, déjà prélevé et reste à prélever ce mois ; total général par devise. Tri mémorisé, filtres |

## Budget journalier

| Sujet | Décision |
| --- | --- |
| Période | De l'échéance prévue de la paie à la veille de la suivante ; la durée suit la fréquence de la paie |
| Budget par période | Montant fixe choisi par l'utilisateur, proposé à chaque paie, modifiable pour une période |
| Budget du jour | (budget − dépenses de la période hors aujourd'hui) ÷ jours restants aujourd'hui compris |
| Projection des jours suivants | (budget − dépenses aujourd'hui compris) ÷ jours restants après aujourd'hui, mise à jour à chaque dépense ; seule la flèche est colorée |
| Démarrage en cours de période | L'utilisateur indique ce qu'il lui reste à dépenser ; enveloppe = reste + dépenses déjà saisies |
| Non affecté à la paie | Paie − charges de la période − budget, affiché pour information seulement : il reste sur le compte et sera réparti à la fin de la quinzaine suivante (plus de question à la paie) |
| Non affecté sur l'accueil | Montant non affecté de la période moins les imprévus payés avec le solde, pour information |
| Revenu ponctuel / virement reçu | Proposé à l'ajout à l'enveloppe si reçu sur un compte du budget pendant la période |
| Fin de période | Pas de report ni de rangement automatique. Bilan conservé : budget, dépensé, écart, jours respectés, dépenses par catégorie comparées à la période précédente, et la répartition de fin de quinzaine |
| Fin de quinzaine (jour de paie) | Reste à répartir = solde du compte principal le soir du dernier jour − dû sur la carte − sécurité déjà là. L'utilisateur choisit la part épargnée (et un projet, facultatif) : virement compte principal → compte épargne à la date choisie (aujourd'hui par défaut), à refaire à la banque. Le reste s'ajoute à la sécurité. Sans compte épargne : tout en sécurité. Reste ≤ 0 : rien à répartir |

## Épargne, calendrier, alertes, analyses

| Sujet | Décision |
| --- | --- |
| Sécurité | Argent laissé sur le compte principal pour les imprévus, affiché sur l'accueil seulement (plus dans l'onglet Épargne). Stockée dans l'objectif « Sécurité » existant, donc le montant d'avant est conservé sans conversion. Cible de 2 000 fixée une fois si aucune n'existait, modifiable. Augmente à la fin de quinzaine ou à la main (ajouter / retirer). Plus de mouvements automatiques ; ceux d'avant sont conservés. Barres : part du solde du compte et progression vers la cible |
| Disponible | Solde du compte principal − dû sur la carte − sécurité |
| Épargne (onglet) | Total épargné = solde réel des comptes de type « Épargne ». Projets (PS5, voyage…) : virtuels, ils répartissent ce total sans changer aucun compte ; création possible seulement avec un compte épargne. « Pas encore dans un projet » = total − projets. Projet terminé : archivé, visible dans « Projets terminés » |
| Conversion des anciens objectifs | Une fois, depuis une carte sur l'accueil et l'onglet Épargne : sauvegarde proposée d'abord, puis pour chaque objectif « Ajouter à la sécurité » (même compte que la sécurité seulement) ou « Archiver ». Rien n'est fait avant « Valider » ; l'historique est conservé |
| Imprévu « Payé comment ? » | Solde du compte (ou carte si la dépense est sur la carte), sécurité ou épargne (avec un projet facultatif). Toujours hors budget du jour et compté dans sa catégorie. Sécurité : la dépense réduit le compte et la sécurité. Épargne : la dépense reste sur son compte ou sa carte, et un virement lié du même montant va du compte épargne au compte principal (à refaire à la banque) ; il suit la dépense (montant, date) et disparaît avec elle |
| Calendrier et fin de quinzaine | Toujours projeté depuis le solde réel : l'épargne de fin de quinzaine est un vrai virement, donc chaque projection repart d'un chiffre juste |
| Épargne dans Analyses | Virements des comptes affichés vers les comptes épargne − retraits de l'épargne vers ces comptes |
| Dettes (onglet Épargne) | Crédits actifs non remboursés : capital restant dû, progression (montant emprunté → 0), dernière mensualité (date de fin ou fin réelle si le capital est remboursé avant), mensualités restantes ; total du capital restant par devise |
| Projection d'un objectif | Moyenne mensuelle des mises de côté des 3 derniers mois (reprises non déduites) appliquée à ce qui manque ; rien sans montant cible ; « Pas encore de rythme » sans mise de côté récente |
| Ordre des projets | Par nom tant qu'aucun ordre n'est choisi ; boutons monter / descendre (« Organiser »), ordre mémorisé |
| Calendrier | Vue du compte du budget = compte + carte additionnés. Projection : reste du budget du jour, budget des jours suivants jusqu'à la fin de la période (le non affecté reste sur le compte, il n'est pas supposé dépensé), puis budget par période réparti sur les jours des périodes futures |
| Cases du calendrier | Montants en 12 px gras, contraste ≥ 4,5:1 (vert et rouge foncés). Passé : fond blanc, dépensé (vert si budget du jour respecté, rouge sinon). Futur : fond bleu très pâle, solde projeté ; rouge pâle si négatif. Aujourd'hui : pastille bleue |
| Budgets par catégorie | Budget mensuel facultatif sur une catégorie principale (ses sous-catégories comptent), mois civil, comptes du budget du jour. Toutes les dépenses comptent (budget du jour, à côté, épargne), pas les charges fixes. Barres dans Analyses (vue Mois) et la page de la période ; bandeaux à 80 % puis au dépassement |
| Revue de fin de mois | Bandeau « Ta revue de … est prête » du 1er au 7 du mois, tant que la revue n'est pas ouverte (et seulement si le mois écoulé a des données). Comptes du budget du jour : total dépensé (quotidien + charges fixes), revenus, épargne, top 3 des catégories, comparaison avec le mois précédent et la moyenne des 3 mois (mois sans données ignorés), budgets par catégorie, jours dans le budget du jour. Historique dans Analyses (12 derniers mois avec données) |
| Mode voyage | Voyage = nom, compte, dates, budget total. Dépenses de ce compte pendant les dates rattachées au voyage. Budget par jour = reste ÷ jours restants. Carte sur l'accueil pendant le voyage puis 3 jours après (bilan). Compte proposé : celui du dernier voyage, sinon le premier compte hors budget du jour (pas de nom de banque dans le code). Le budget du jour principal n'est pas modifié |
| Base de données version 2 | Ajout de la table des voyages, sans modifier les données existantes (test de migration). Les voyages sont dans la sauvegarde ; une sauvegarde plus ancienne se restaure toujours |
| Abonnements | Charges fixes de la catégorie « Abonnements » (repérée par son identifiant, donc même renommée). Coût mensuel et annuel de chacun, totaux par devise (actifs). Alerte douce dans l'écran (pas de bandeau) si plusieurs abonnements actifs ont la même sous-catégorie. Accès depuis Analyses et Réglages |
| Bandeaux d'alerte | Budget du jour dépassé, solde projeté négatif, charges à venir (délai réglable), fin d'un crédit, rappel de sauvegarde. Masquables jusqu'au lendemain |
| Analyses | Semaine, période de paie, mois, compte par compte. Charges fixes exclues des catégories par défaut. Toutes les dépenses figurent dans les catégories, quel que soit leur financement |
| Comparaison des catégories | Avec la période précédente et avec la moyenne des périodes précédentes de même durée (jusqu'à 3, le nombre réellement utilisé est affiché) ; la couleur suit la moyenne, un trait la marque sur la barre |
| Mois par mois | Dépenses du quotidien (hors charges fixes) des 6 derniers mois, 12 en option ; toucher un mois ouvre l'analyse mensuelle. Barres au contraste ≥ 3:1, mois affiché en plus foncé |
| Top et dépenses à classer | 5 plus grosses dépenses de la période affichée ; dépenses sans catégorie signalées avec une liste pour les classer |
