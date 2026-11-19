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
| Non affecté à la paie | Paie − charges de la période − budget, annoncé avec un choix : tout en Sécurité, une partie, ou le laisser sur le compte (rien de présélectionné) |
| « À côté du budget » | Part du non affecté laissée sur le compte, modifiable. Dépense « à côté » : hors budget du jour, comptée dans sa catégorie. Le reste non utilisé va dans Sécurité en fin de période |
| Revenu ponctuel / virement reçu | Proposé à l'ajout à l'enveloppe si reçu sur un compte du budget pendant la période |
| Fin de période | Pas de report : un reste part dans Sécurité, un dépassement est noté. Bilan conservé : budget, dépensé, écart, jours respectés, dépenses par catégorie comparées à la période précédente |

## Épargne, calendrier, alertes, analyses

| Sujet | Décision |
| --- | --- |
| Objectif « Sécurité » | Créé sur le compte du budget du jour ; reçoit l'épargne de la paie et les restes de période (mouvements automatiques sans doublon) |
| Épargne déjà présente | Proposition générale : compte au choix, nom et montant |
| Imprévu payé avec l'épargne | Vraie dépense (solde, catégories), retirée de l'objectif, hors budget du jour |
| Disponible réel | Solde − épargne réservée |
| Dettes (onglet Épargne) | Crédits actifs non remboursés : capital restant dû, progression (montant emprunté → 0), dernière mensualité (date de fin ou fin réelle si le capital est remboursé avant), mensualités restantes ; total du capital restant par devise |
| Projection d'un objectif | Moyenne mensuelle des mises de côté des 3 derniers mois (reprises non déduites) appliquée à ce qui manque ; rien sans montant cible ; « Pas encore de rythme » sans mise de côté récente |
| Ordre des objectifs | Sécurité d'abord puis par nom, tant qu'aucun ordre n'est choisi ; boutons monter / descendre (« Organiser »), ordre mémorisé |
| Calendrier | Vue du compte du budget = compte + carte additionnés. Projection : reste du budget du jour, budget des jours suivants et reste « à côté » jusqu'à la fin de la période, puis budget par période réparti sur les jours des périodes futures |
| Cases du calendrier | Montants en 12 px gras, contraste ≥ 4,5:1 (vert et rouge foncés). Passé : fond blanc, dépensé (vert si budget du jour respecté, rouge sinon). Futur : fond bleu très pâle, solde projeté ; rouge pâle si négatif. Aujourd'hui : pastille bleue |
| Budgets par catégorie | Budget mensuel facultatif sur une catégorie principale (ses sous-catégories comptent), mois civil, comptes du budget du jour. Toutes les dépenses comptent (budget du jour, à côté, épargne), pas les charges fixes. Barres dans Analyses (vue Mois) et la page de la période ; bandeaux à 80 % puis au dépassement |
| Bandeaux d'alerte | Budget du jour dépassé, solde projeté négatif, charges à venir (délai réglable), fin d'un crédit, rappel de sauvegarde. Masquables jusqu'au lendemain |
| Analyses | Semaine, période de paie, mois, compte par compte. Charges fixes exclues des catégories par défaut. Toutes les dépenses figurent dans les catégories, quel que soit leur financement |
| Comparaison des catégories | Avec la période précédente et avec la moyenne des périodes précédentes de même durée (jusqu'à 3, le nombre réellement utilisé est affiché) ; la couleur suit la moyenne, un trait la marque sur la barre |
| Mois par mois | Dépenses du quotidien (hors charges fixes) des 6 derniers mois, 12 en option ; toucher un mois ouvre l'analyse mensuelle. Barres au contraste ≥ 3:1, mois affiché en plus foncé |
| Top et dépenses à classer | 5 plus grosses dépenses de la période affichée ; dépenses sans catégorie signalées avec une liste pour les classer |
