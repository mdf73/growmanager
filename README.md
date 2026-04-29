# 🌱 GrowManager

Application personnelle de gestion de cultures cannabis. Suivi complet du cycle de vie des plantes, des graines, du stock, des extractions, des capteurs et du sol vivant.

---

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query v5 |
| Backend | FastAPI 0.111 + SQLAlchemy 2.0 + PyMySQL |
| Base de données | MySQL 8 |
| Containerisation | Docker Compose |

---

## Lancement rapide

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git

### Installation

```bash
git clone https://github.com/mdf73/growmanager.git
cd growmanager

# Copier et configurer les variables d'environnement
copy .env.example .env
# Éditer .env avec vos propres mots de passe

# Démarrer tous les services
docker-compose up -d
```

L'application est disponible sur :
- **Frontend** → http://localhost:5173
- **API** → http://localhost:8000
- **API Docs** → http://localhost:8000/docs

---

## Structure du projet

```
growmanager/
├── backend/
│   └── app/
│       ├── main.py              # Point d'entrée, migrations, routers
│       ├── models/all_models.py # Tous les modèles SQLAlchemy
│       ├── routers/             # 29 routers (un par domaine)
│       ├── schemas/             # Schémas Pydantic
│       └── database.py          # Engine, session
├── frontend/
│   └── src/
│       ├── api/                 # 28 clients Axios
│       ├── pages/               # 25 pages React
│       ├── components/          # Composants partagés
│       └── App.tsx              # Table de routage
├── wiki/                        # Documentation technique (Obsidian)
├── docker-compose.yml
└── .env.example                 # Template des variables d'environnement
```

---

## Fonctionnalités

- **Cultures & Plantes** — cycle de vie complet (germination → récolte → curing)
- **Graines** — catalogue Breeder → Variété → Pack → Graine individuelle
- **Stock** — fleur, hash, rosin avec traçabilité par culture
- **Extractions** — sessions rosin (presse) et hash (ice-o-lator)
- **Recettes** — TCO, LSO, arrosage, fermentation, réamendement, schémas engrais
- **Sol Vivant** — suivi complet SuiviSolVivant + sous-événements
- **Capteurs** — intégration Govee H5179 (LAN + cloud), graphiques VPD
- **Planning** — PlanCulture avec simulateur de dates de récolte
- **Génétique** — gestion du pollen et croisements (F1/F2/BX/S1/IBL)
- **Classement** — scoring variétés /100 (Culture /30 + Consommation /70)
- **Équipement** — inventaire complet boxes, lampes, pots, vaporisateurs

---

## Commandes utiles

```bash
# Redémarrer le backend après modifications Python
docker-compose restart backend

# Voir les logs du backend
docker-compose logs -f backend

# Se connecter à MySQL
docker exec -it growmanager-db-1 mysql -u root -p growmanager

# Arrêter tout
docker-compose down
```

---

## Variables d'environnement

Copier `.env.example` en `.env` et renseigner :

```env
MYSQL_ROOT_PASSWORD=   # Mot de passe root MySQL
MYSQL_USER=            # Utilisateur MySQL
MYSQL_PASSWORD=        # Mot de passe utilisateur MySQL
SECRET_KEY=            # Clé secrète pour l'application
```

---

## Documentation

La documentation technique complète est dans le dossier [`wiki/`](./wiki/index.md) :

- Architecture, stack, patterns de dev
- Schéma de base de données complet
- Documentation de tous les endpoints API
- Conventions frontend (React Query, Tailwind, hooks)
- Roadmap et backlog

---

*Projet personnel — usage privé.*
