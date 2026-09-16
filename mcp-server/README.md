# Serveur MCP GrowManager

Serveur MCP (Model Context Protocol) qui permet à une IA compatible MCP
(Claude Desktop, Claude Code, etc.) d'interagir avec GrowManager : cultures,
plantes, stock, graines, capteurs, recettes, etc.

Un seul et même script (`server.py`) sert **deux déploiements différents** :

| | Poste Windows (existant) | Serveur Linux de prod (nouveau) |
|---|---|---|
| Transport | stdio (sous-processus local) | HTTP réseau ("Streamable HTTP") |
| Accès | Claude Desktop/Code sur la même machine | Toute IA compatible MCP sur le réseau local |
| Droits | Lecture seule | Lecture + écriture |
| Authentification | Aucune (processus local) | Jeton porteur obligatoire |
| Contrôlé par | `GROWMANAGER_MCP_TRANSPORT=stdio` (défaut) | `GROWMANAGER_MCP_TRANSPORT=http` |

## Comment ça marche

Au démarrage, le serveur récupère le schéma OpenAPI de l'API GrowManager
(`GET /openapi.json`) et génère automatiquement un outil MCP pour chaque
endpoint. En mode lecture seule, seuls les `GET` sont exposés. En mode
lecture + écriture, `POST`/`PUT`/`PATCH`/`DELETE` le sont aussi, avec des
annotations MCP fidèles (`readOnlyHint`, `destructiveHint`, `idempotentHint`)
pour que les clients compatibles avertissent avant une action destructive
(ex. une suppression).

Rien à maintenir manuellement : un nouvel endpoint côté backend apparaît
automatiquement comme nouvel outil au prochain démarrage.

Quelques endpoints sont exclus par défaut quel que soit le mode
(`GROWMANAGER_MCP_EXCLUDE`) : `/health`, `/api/import-export` (import/export
en masse) et `/api/tapo/discover` (scan réseau des prises Tapo).

---

## 1. Installation locale sur Windows (stdio, lecture seule)

Inchangée : c'est le mode par défaut si tu ne définis aucune variable
d'environnement particulière.

```bat
cd C:\Users\Pik\Documents\Claudio\growmanager\mcp-server
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python server.py
```

Tu dois voir un log du type :
```
INFO growmanager_mcp: Serveur MCP GrowManager : 62 outils (lecture seule) générés depuis http://localhost:8000
```
`Ctrl+C` pour arrêter.

**Claude Desktop** — dans `%APPDATA%\Claude\claude_desktop_config.json` :
```json
{
  "mcpServers": {
    "growmanager": {
      "command": "C:\\Users\\Pik\\Documents\\Claudio\\growmanager\\mcp-server\\venv\\Scripts\\python.exe",
      "args": ["C:\\Users\\Pik\\Documents\\Claudio\\growmanager\\mcp-server\\server.py"]
    }
  }
}
```

**Claude Code** (dans ce repo) — fusionne à la main dans `.mcp.json` à côté
de l'entrée `github` existante (ne pas écraser le fichier, il contient un
jeton) :
```json
"growmanager": {
  "command": "C:\\Users\\Pik\\Documents\\Claudio\\growmanager\\mcp-server\\venv\\Scripts\\python.exe",
  "args": ["C:\\Users\\Pik\\Documents\\Claudio\\growmanager\\mcp-server\\server.py"]
}
```

---

## 2. Installation sur le serveur Linux de prod (HTTP, lecture + écriture)

Le serveur MCP est packagé comme un conteneur Docker de plus, construit et
publié sur GHCR exactement comme `backend` et `frontend` (voir
`.github/workflows/docker-publish.yml`), et déployé via
`docker-compose.prod.yml` + `update.sh`, sans rien changer au workflow
existant.

### Étape 1 — Pousser le code (depuis Windows)

Double-clique sur `push.bat` comme d'habitude (commit + bump de version +
push vers `main`). GitHub Actions construit alors trois images au lieu de
deux : `growmanager-backend`, `growmanager-frontend` et
**`growmanager-mcp-server`**.

### Étape 2 — Configurer le jeton sur le serveur (une seule fois)

Le serveur MCP en mode réseau **refuse de démarrer sans jeton** (protection
volontaire : sans ça, n'importe quel appareil du réseau local pourrait lire
et modifier tes données sans authentification).

Sur le serveur (`ssh clapie`), dans `~/growmanager/.env.production` (le
fichier réel, symlinké en `.env` — voir le piège documenté dans le wiki) :
```bash
openssl rand -base64 32   # copie la sortie
nano .env.production      # colle-la dans GROWMANAGER_MCP_TOKEN=...
```
Le fichier `.env.production` du dépôt (avec des valeurs placeholder) a déjà
les nouvelles clés :
```env
GROWMANAGER_MCP_TOKEN=changer-ce-jeton-genere-avec-openssl-rand-base64-32
GROWMANAGER_MCP_READONLY=false
MCP_PORT=8100
```
> ⚠️ Ne commite jamais la vraie valeur du jeton — seul le placeholder doit
> rester dans git. Le fichier réel reste local au serveur.

### Étape 3 — Déployer

```bash
ssh clapie
cd growmanager
git pull                # récupère le nouveau docker-compose.prod.yml
./update.sh latest      # pull + redémarre backend, frontend et mcp-server
```

Vérifie que ça tourne :
```bash
curl http://localhost:8100/healthz
# {"status": "ok", "outils": 62, "mode": "read-write"}
```

### Étape 4 — Connecter une IA au serveur MCP distant

Le serveur écoute sur `http://<IP-du-serveur>:8100/mcp` (ex.
`http://192.168.1.156:8100/mcp`), accessible depuis le réseau local
uniquement (pas exposé via `pikgrow.pikti.fr`).

**Claude Code** (CLI) :
```bash
claude mcp add --transport http growmanager http://192.168.1.156:8100/mcp \
  --header "Authorization: Bearer <TON_JETON>"
```

**Claude Desktop / Claude Code** (config JSON, si tu préfères éditer le
fichier directement — vérifie la syntaxe exacte attendue par ta version, ce
schéma est celui documenté pour un serveur MCP distant en HTTP) :
```json
{
  "mcpServers": {
    "growmanager": {
      "url": "http://192.168.1.156:8100/mcp",
      "headers": {
        "Authorization": "Bearer <TON_JETON>"
      }
    }
  }
}
```

---

## Variables d'environnement (toutes optionnelles sauf `GROWMANAGER_MCP_TOKEN` en mode http)

| Variable | Défaut | Rôle |
|---|---|---|
| `GROWMANAGER_API_URL` | `http://localhost:8000` (Windows) / `http://backend:8000` (Docker) | URL de base de l'API GrowManager |
| `GROWMANAGER_MCP_EXCLUDE` | `/health,/api/import-export,/api/tapo/discover` | Motifs de chemin à ne jamais exposer |
| `GROWMANAGER_MCP_READONLY` | `true` | `false` pour exposer aussi POST/PUT/PATCH/DELETE |
| `GROWMANAGER_MCP_TRANSPORT` | `stdio` | `http` pour le mode réseau (conteneur) |
| `GROWMANAGER_MCP_TOKEN` | *(aucun)* | Jeton porteur — **obligatoire** en mode `http` |
| `GROWMANAGER_MCP_HTTP_HOST` | `0.0.0.0` | Adresse d'écoute en mode http |
| `GROWMANAGER_MCP_HTTP_PORT` | `8100` | Port d'écoute en mode http |

## Sécurité — ce qui change en mode lecture + écriture

- Chaque outil d'écriture porte une annotation MCP correcte
  (`destructiveHint: true` pour les suppressions, `readOnlyHint: false`
  pour tout le reste) : un client MCP qui respecte ces annotations
  demandera une confirmation avant d'exécuter une suppression.
- Le corps de requête (POST/PUT/PATCH) est passé sous la clé `"body"` dans
  les arguments de l'outil, avec un schéma JSON dérivé des modèles Pydantic
  du backend (y compris les objets imbriqués).
- Le mode `http` refuse de démarrer sans `GROWMANAGER_MCP_TOKEN` défini.
- Le serveur n'est routé nulle part dans la config `nginx` publique : il
  n'est joignable que depuis le réseau local du serveur.
- Pour revenir en lecture seule sur le serveur sans tout redéployer :
  ```bash
  # dans .env.production
  GROWMANAGER_MCP_READONLY=true
  docker compose -f docker-compose.prod.yml up -d --no-deps mcp-server
  ```

## Limites connues

- Les noms d'outils sont dérivés automatiquement des chemins et méthodes
  HTTP de l'API (ex. `growmanager_update_api_cultures_by_culture_id`) plutôt
  que pensés un par un — c'est le compromis du mode "auto-généré" choisi
  pour couvrir toute l'API sans effort de maintenance.
- Chaque réponse est tronquée à 20 000 caractères ; utilise les paramètres
  de filtre/pagination proposés par l'outil pour les endpoints volumineux.
- Aucune granularité fine des droits : c'est tout GET, ou GET + écriture. Si
  tu veux un jour restreindre l'écriture à certains routers seulement,
  `GROWMANAGER_MCP_EXCLUDE` permet d'exclure des chemins entiers.
