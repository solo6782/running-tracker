# 🏃 Running Tracker — Guide d'installation

Application multi-sport de suivi d'entraînement avec sync automatique Strava.

## Architecture

```
Garmin (montre) → Strava → Webhook → Cloudflare Worker → Supabase → UI SvelteKit
```

## Prérequis

- Node.js 18+
- Un compte [Cloudflare](https://dash.cloudflare.com) (gratuit)
- Un compte [Supabase](https://supabase.com) (gratuit)
- Un compte [Strava](https://www.strava.com) avec des activités

---

## Étape 1 — Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **New Project**
2. Note ton **Project URL** et ta **anon key** (Settings → API)
3. Note aussi ta **service_role key** (Settings → API → service_role, **secret**)
4. Va dans **SQL Editor** et exécute le contenu du fichier `supabase/migration.sql`

---

## Étape 2 — Créer l'app Strava

1. Va sur [strava.com/settings/api](https://www.strava.com/settings/api)
2. Crée une application :
   - **Application Name** : Running Tracker
   - **Category** : Training
   - **Website** : `https://ton-app.pages.dev` (ou `http://localhost:5173` pour le dev)
   - **Authorization Callback Domain** : `ton-app.pages.dev` (ou `localhost` pour le dev)
3. Note ton **Client ID** et **Client Secret**

---

## Étape 3 — Configuration locale

```bash
# Clone ou copie le projet
cd running-app

# Installe les dépendances
npm install

# Copie et remplis les variables d'environnement
cp .env.example .env
```

Remplis le fichier `.env` :
```
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abcdef...
STRAVA_WEBHOOK_VERIFY_TOKEN=un-secret-de-ton-choix
PUBLIC_APP_URL=http://localhost:5173
```

---

## Étape 4 — Lancer en local

```bash
npm run dev
```

Va sur `http://localhost:5173` → clique **Connecter Strava** → autorise → clique **Importer l'historique**.

---

## Étape 5 — Déployer sur Cloudflare Pages

```bash
# Connecte Wrangler à ton compte Cloudflare
npx wrangler login

# Déploie
npm run deploy
```

Ensuite, dans le **dashboard Cloudflare** → Pages → ton projet → Settings → Environment variables :
Ajoute toutes les variables du `.env` (en tant que secrets pour les clés sensibles).

Met à jour `PUBLIC_APP_URL` avec l'URL de ton déploiement (ex: `https://running-tracker.pages.dev`).

---

## Étape 6 — Activer le webhook Strava

Le webhook permet la sync automatique des futures activités. Envoie cette requête curl :

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=TON_CLIENT_ID \
  -F client_secret=TON_CLIENT_SECRET \
  -F callback_url=https://ton-app.pages.dev/api/strava/webhook \
  -F verify_token=ton-verify-token
```

Strava va appeler ton endpoint GET pour valider, puis commencera à envoyer les événements.

---

## Étape 7 — Mettre à jour l'app Strava

Une fois déployé, retourne sur [strava.com/settings/api](https://www.strava.com/settings/api) et mets à jour :
- **Website** : `https://ton-app.pages.dev`
- **Authorization Callback Domain** : `ton-app.pages.dev`

---

## Structure du projet

```
running-app/
├── src/
│   ├── app.html                          # Template HTML
│   ├── app.css                           # Styles globaux (dark mode)
│   ├── lib/
│   │   ├── supabase.js                   # Client Supabase
│   │   ├── strava.js                     # Helpers API Strava
│   │   └── format.js                     # Formatage (pace, distance, durée)
│   └── routes/
│       ├── +layout.svelte                # Layout racine
│       ├── +page.svelte                  # Accueil (connexion Strava)
│       ├── +page.server.js               # Loader serveur
│       ├── auth/strava/callback/
│       │   └── +server.js                # OAuth callback Strava
│       └── api/strava/
│           ├── import/+server.js         # Import historique
│           └── webhook/+server.js        # Webhook sync auto
├── supabase/
│   └── migration.sql                     # Schéma base de données
├── package.json
├── svelte.config.js                      # Config SvelteKit + Cloudflare
├── vite.config.js
├── wrangler.toml                         # Config Cloudflare
└── .env.example                          # Variables d'environnement
```

---

## Phases suivantes

- **Phase 2** : Liste des activités avec filtres et saisie du ressenti
- **Phase 3** : Dashboard avec résumé hebdo/mensuel
- **Phase 4** : Graphiques d'évolution
- **Phase 5** : Polish, responsive, gestion d'erreurs
