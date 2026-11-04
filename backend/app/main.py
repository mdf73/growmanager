"""Application FastAPI pour GrowManager"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import breeders, varietes, graines, cultures, stock, extractions, dashboard, fournisseurs, import_export, historique_culture, materiel, parametre, engrais, recette_engrais, recette_tco, recette_lso, recette_reamendement, recette_arrosage, recette_fermentation, suivi_sol_vivant, espaces, capteurs, plan_culture, preparation_substrat, notation_variete, vaporisateur, sechage, curing, croisement, app_settings, consommation, photos, stock_alert_seuils, search, calendrier, esphome, open_field, tapo
from app.services.govee_poller import start_poller
from app.db_init import init_database

# Création de l'application FastAPI
app = FastAPI(
    title="GrowManager API",
    description="API pour la gestion de cultures de cannabis",
    version="3.18.0",
)

# Configuration CORS pour le développement
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialisation de la base (tables, migrations, seeds) : voir app/db_init.py.
# En production elle est faite une seule fois avant le lancement des workers
# (GM_SKIP_DB_INIT=1), sinon chaque worker la ferait en parallèle.
if os.environ.get("GM_SKIP_DB_INIT") != "1":
    init_database()

# Inclusion des routers
app.include_router(breeders.router)
app.include_router(varietes.router)
app.include_router(graines.router)
app.include_router(cultures.router)
app.include_router(stock.router)
app.include_router(extractions.router)
app.include_router(dashboard.router)
app.include_router(fournisseurs.router)
app.include_router(import_export.router)
app.include_router(historique_culture.router)
app.include_router(materiel.router)
app.include_router(parametre.router)
app.include_router(engrais.router)
app.include_router(recette_engrais.router)
app.include_router(recette_tco.router)
app.include_router(recette_lso.router)
app.include_router(recette_reamendement.router)
app.include_router(recette_arrosage.router)
app.include_router(recette_fermentation.router)
app.include_router(suivi_sol_vivant.router)
app.include_router(espaces.router)
app.include_router(capteurs.router)
app.include_router(plan_culture.router)
app.include_router(preparation_substrat.router)
app.include_router(notation_variete.router)
app.include_router(vaporisateur.router)
app.include_router(sechage.router)
app.include_router(curing.router)
app.include_router(croisement.router)
app.include_router(open_field.router)
app.include_router(app_settings.router)
app.include_router(consommation.router)
app.include_router(photos.router)
app.include_router(stock_alert_seuils.router)
app.include_router(search.router)
app.include_router(calendrier.router)
app.include_router(esphome.router)
app.include_router(tapo.router)

# Fichiers statiques — photos uploadées
os.makedirs("/app/uploads/photos/thumbs", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

# Démarrage du poller Govee (si APScheduler installé)
start_poller(app)


@app.get("/")
def read_root():
    """Endpoint racine"""
    return {
        "message": "Bienvenue sur l'API GrowManager",
        "version": "3.18.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    """Vérification de la santé de l'API"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
