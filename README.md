# Budget

App de budget personnelle pour iPhone : une PWA installée depuis Safari, avec toutes les données stockées sur l'appareil (IndexedDB). Aucun serveur ne reçoit de données, aucun suivi.

## Installer sur l'iPhone

1. Ouvrir l'URL GitHub Pages dans **Safari**.
2. **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Ouvrir **Budget** depuis l'icône et choisir un code à 6 chiffres.

> L'onglet Safari et l'app installée ont chacun leurs propres données. Supprimer l'icône efface les données de l'app.

## Développement

```bash
npm install
npm run dev        # serveur local (accessible depuis l'iPhone sur le même Wi-Fi)
npm test           # tests des calculs (Vitest)
npm run build      # build de production dans dist/
npm run icons      # régénère les icônes (Python + Pillow)
```

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml` : tests, build, publication sur GitHub Pages.
Au premier lancement, un parcours d'accueil crée les comptes : l'app ne contient aucune donnée par défaut.
À faire une seule fois sur GitHub : **Settings → Pages → Source : GitHub Actions**.

## Fonctionnalités (V1)

Saisie rapide (dépense, revenu, virement), comptes et carte de crédit, charges fixes, crédits et revenus récurrents
avec prélèvement automatique, budget journalier (budget fixe par période, projection des jours suivants, bilan par catégorie),
calendrier avec solde projeté, épargne virtuelle (Sécurité, objectifs), bandeaux d'alerte, analyses,
sauvegarde chiffrée, export CSV, code PIN et Face ID. Décisions détaillées : `docs/DECISIONS.md`.

## Structure

```
src/
  domain/      fonctions pures + types (montants en centimes, calculs) — testées
  security/    PIN haché (PBKDF2), délai après erreurs, verrouillage auto, sauvegarde chiffrée (AES-GCM), Face ID
  db/          base Dexie (7 tables), actions, sauvegarde / restauration
  budget/      carte du budget, période, bilan, remboursement de carte
  hooks/       lectures réactives, état du budget, projection du solde
  lock/        écrans de création / saisie du code, contexte de verrouillage
  components/  barre d'onglets, bouton +, panneaux, cartes
  saisie/      saisie rapide : orchestration, modes (dépense, revenu, virement), confirmation
  accueil/     parcours d'accueil d'un nouvel utilisateur
  screens/     Accueil, Calendrier, Analyses, Épargne, Réglages
               (reglages/recurrences/ : liste, formulaire, filtres et infos crédit des charges et revenus)
```

Règle : tout calcul (soldes, montant dû carte, enveloppe, budget du jour, projection, capital restant) vit dans `src/domain/` sous forme de fonction pure, avec ses tests à côté (`*.test.ts`).
