# Skull King Score Tracker

Une application web moderne sur le thème des pirates pour suivre les scores lors de vos parties de Skull King. App simple avec des pages html statiques et une bdd supabase (gratuit).

## Fonctionnalités

*   **Design Immersif** : Interface soignée avec textures parchemin et effets de verre.
*   **Gestion de Partie** :
    *   Création de nouvelles parties avec liste de joueurs personnalisable.
    *   Système de "Taverne" pour retrouver facilement les joueurs existants.
    *   Désignation aléatoire du premier joueur (capitaine) avec animation.
*   **Suivi des Scores** :
    *   Saisie manche par manche des paris, plis gagnés et bonus.
    *   Calcul automatique des scores selon les règles officielles du Skull King.
    *   Interface optimisée pour mobile et desktop.
*   **Statistiques** :
    *   Tableau des scores complet.
    *   Interface d'administration pour gérer l'historique.

## Stack Technique

*   **Framework** : Next.js 15 (App Router)
*   **Style** : CSS Modules (Vanilla CSS)
*   **Base de données** : Supabase (PostgreSQL)
*   **Conteneurisation** : Docker & Docker Compose

## Installation

### Prérequis

*   Node.js 18+
*   Docker (optionnel)
*   Compte Supabase

### Lancer le projet

1.  **Cloner le dépôt**
2.  **Installer les dépendances** :
    ```bash
    npm install
    ```
3.  **Configuration** :
    Copiez le fichier `.env.example` en `.env` et remplissez vos identifiants Supabase.
    ```bash
    cp .env.example .env
    ```
4.  **Lancer en local** :
    ```bash
    npm run dev
    ```
    L'application sera accessible sur `http://localhost:3000`.

### Docker

```bash
docker-compose up --build
```

## Licence

Ce code est libre de droits.
