"""Application FastAPI pour GrowManager"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.database import Base, engine
from app.routers import breeders, varietes, graines, cultures, stock, extractions, dashboard, fournisseurs, import_export, historique_culture, materiel, parametre, engrais, recette_engrais, recette_tco, recette_lso, recette_reamendement, recette_arrosage, recette_fermentation, suivi_sol_vivant, espaces, capteurs, plan_culture, preparation_substrat, notation_variete, vaporisateur, sechage, curing, croisement, app_settings, consommation, photos, stock_alert_seuils, search, calendrier
from app.services.govee_poller import start_poller

# Création de l'application FastAPI
app = FastAPI(
    title="GrowManager API",
    description="API pour la gestion de cultures de cannabis",
    version="3.1.0",
)

# Configuration CORS pour le développement
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Création des tables
Base.metadata.create_all(bind=engine)

# Migration: ajout des nouvelles colonnes si elles n'existent pas
# Utilise INFORMATION_SCHEMA car MySQL ne supporte pas ADD COLUMN IF NOT EXISTS
def run_migrations():
    migrations = [
        ("Variete",          "lien_web",                 "ALTER TABLE Variete ADD COLUMN lien_web VARCHAR(500)"),
        ("PackGraine",       "duree_conservation_mois",  "ALTER TABLE PackGraine ADD COLUMN duree_conservation_mois INT"),
        ("Stock",            "lampe_type",               "ALTER TABLE Stock ADD COLUMN lampe_type VARCHAR(50)"),
        ("Stock",            "engrais_type",             "ALTER TABLE Stock ADD COLUMN engrais_type VARCHAR(50)"),
        ("RosinExtraction",  "sac_1_poids",       "ALTER TABLE RosinExtraction ADD COLUMN sac_1_poids DECIMAL(10,2)"),
        ("RosinExtraction",  "sac_2_poids",       "ALTER TABLE RosinExtraction ADD COLUMN sac_2_poids DECIMAL(10,2)"),
        ("RosinExtraction",  "sac_3_poids",       "ALTER TABLE RosinExtraction ADD COLUMN sac_3_poids DECIMAL(10,2)"),
        ("RosinExtraction",  "sac_4_poids",       "ALTER TABLE RosinExtraction ADD COLUMN sac_4_poids DECIMAL(10,2)"),
        ("RosinExtraction",  "maillage",          "ALTER TABLE RosinExtraction ADD COLUMN maillage VARCHAR(20)"),
        ("RosinExtraction",  "presse_1_poids",    "ALTER TABLE RosinExtraction ADD COLUMN presse_1_poids DECIMAL(10,2)"),
        ("RosinExtraction",  "presse_2_poids",    "ALTER TABLE RosinExtraction ADD COLUMN presse_2_poids DECIMAL(10,2)"),
        ("RosinExtraction",  "presse_3_poids",    "ALTER TABLE RosinExtraction ADD COLUMN presse_3_poids DECIMAL(10,2)"),
        ("RosinExtraction",  "presse_4_poids",    "ALTER TABLE RosinExtraction ADD COLUMN presse_4_poids DECIMAL(10,2)"),
        # HistoriqueCulture — colonnes ajoutées progressivement
        ("HistoriqueCulture", "notes",    "ALTER TABLE HistoriqueCulture ADD COLUMN notes TEXT"),
        ("HistoriqueCulture", "substrat", "ALTER TABLE HistoriqueCulture ADD COLUMN substrat VARCHAR(100)"),
        ("HistoriqueCulture", "nom",      "ALTER TABLE HistoriqueCulture ADD COLUMN nom VARCHAR(200)"),
        ("HistoriquePlant", "date_debut_plant", "ALTER TABLE HistoriquePlant ADD COLUMN date_debut_plant DATE"),
        ("HistoriquePlant", "date_fin_plant",   "ALTER TABLE HistoriquePlant ADD COLUMN date_fin_plant DATE"),
        ("Materiel", "date_sortie_stock", "ALTER TABLE Materiel ADD COLUMN date_sortie_stock DATE"),
        # HashExtraction — extension pour Polinator / Ice-o-lator
        ("HashExtraction", "id_stock_source",  "ALTER TABLE HashExtraction ADD COLUMN id_stock_source INT"),
        ("HashExtraction", "type_extraction",  "ALTER TABLE HashExtraction ADD COLUMN type_extraction VARCHAR(20)"),
        ("HashExtraction", "duree_polinator",  "ALTER TABLE HashExtraction ADD COLUMN duree_polinator INT"),
        ("HashExtraction", "passages",         "ALTER TABLE HashExtraction ADD COLUMN passages JSON"),
        ("HashExtraction", "sacs",             "ALTER TABLE HashExtraction ADD COLUMN sacs JSON"),
        # Stock — spécifications Hash et Rosin
        ("Stock", "maillage",    "ALTER TABLE Stock ADD COLUMN maillage VARCHAR(20)"),
        ("Stock", "type_hash",   "ALTER TABLE Stock ADD COLUMN type_hash VARCHAR(50)"),
        ("Stock", "type_rosin",  "ALTER TABLE Stock ADD COLUMN type_rosin VARCHAR(50)"),
        # ProduitEngrais — table complète créée via SQLAlchemy
        # Espaces de culture — id_espace sur Culture et HistoriqueCulture
        ("Culture",          "id_espace",              "ALTER TABLE Culture ADD COLUMN id_espace INT REFERENCES EspaceCulture(id_espace)"),
        ("HistoriqueCulture","id_espace",              "ALTER TABLE HistoriqueCulture ADD COLUMN id_espace INT REFERENCES EspaceCulture(id_espace)"),
        ("EspaceCulture",    "id_materiel_principal",  "ALTER TABLE EspaceCulture ADD COLUMN id_materiel_principal INT REFERENCES Materiel(id_materiel)"),
        # Culture V2 — champs suivi de culture
        ("Culture", "nom",                  "ALTER TABLE Culture ADD COLUMN nom VARCHAR(200)"),
        ("Culture", "date_debut",           "ALTER TABLE Culture ADD COLUMN date_debut DATE"),
        ("Culture", "statut",               "ALTER TABLE Culture ADD COLUMN statut VARCHAR(50) DEFAULT 'active'"),
        ("Culture", "date_fin",             "ALTER TABLE Culture ADD COLUMN date_fin DATE"),
        ("Culture", "date_recolte_estimee", "ALTER TABLE Culture ADD COLUMN date_recolte_estimee DATE"),
        ("Culture", "type_eclairage",       "ALTER TABLE Culture ADD COLUMN type_eclairage VARCHAR(50)"),
        ("Culture", "but_culture",          "ALTER TABLE Culture ADD COLUMN but_culture VARCHAR(100)"),
        # Plant — substrat / pot / recette sol
        ("Plant",   "substrat",             "ALTER TABLE Plant ADD COLUMN substrat VARCHAR(100)"),
        ("Plant",   "id_recette_sol",       "ALTER TABLE Plant ADD COLUMN id_recette_sol INT REFERENCES RecetteLSO(id_recette_lso)"),
        ("Plant",   "id_pot",               "ALTER TABLE Plant ADD COLUMN id_pot INT REFERENCES Pot(id_pot)"),
        ("Plant",   "volume_pot_l",         "ALTER TABLE Plant ADD COLUMN volume_pot_l DECIMAL(6,2)"),
        # ActionCalendrier — paramètres JSON
        ("ActionCalendrier", "parametres",  "ALTER TABLE ActionCalendrier ADD COLUMN parametres JSON"),
        # RecetteTCO — durée d'oxygénation
        ("RecetteTCO", "duree_oxygenation_h", "ALTER TABLE RecetteTCO ADD COLUMN duree_oxygenation_h INT"),
        # TemperatureLog — extension Govee (vpd, id_device, id_culture nullable)
        ("TemperatureLog", "vpd",       "ALTER TABLE TemperatureLog ADD COLUMN vpd FLOAT"),
        ("TemperatureLog", "id_device", "ALTER TABLE TemperatureLog ADD COLUMN id_device INT REFERENCES GoveeDevice(id_device)"),
        # Stock — sortie de stock + bocal Materiel
        ("Stock", "date_fin_stock",    "ALTER TABLE Stock ADD COLUMN date_fin_stock DATE NULL"),
        ("Stock", "id_materiel_bocal", "ALTER TABLE Stock ADD COLUMN id_materiel_bocal INT NULL REFERENCES Materiel(id_materiel)"),
        # SessionCuring — espace de culture optionnel + bocal inventaire
        ("SessionCuring", "id_espace",         "ALTER TABLE SessionCuring ADD COLUMN id_espace INT NULL REFERENCES EspaceCulture(id_espace)"),
        ("SessionCuring", "id_materiel_bocal", "ALTER TABLE SessionCuring ADD COLUMN id_materiel_bocal INT NULL REFERENCES Materiel(id_materiel)"),
        # Vaporisateurs — site_achat ajouté après création initiale
        ("Vaporisateur", "site_achat", "ALTER TABLE Vaporisateur ADD COLUMN site_achat VARCHAR(200)"),
        # Feature 1 — Coûts culture
        ("HistoriqueCulture", "cout_engrais",     "ALTER TABLE HistoriqueCulture ADD COLUMN cout_engrais DECIMAL(10,2) NULL"),
        ("HistoriqueCulture", "cout_electricite", "ALTER TABLE HistoriqueCulture ADD COLUMN cout_electricite DECIMAL(10,2) NULL"),
        ("HistoriqueCulture", "cout_graines",     "ALTER TABLE HistoriqueCulture ADD COLUMN cout_graines DECIMAL(10,2) NULL"),
        ("HistoriqueCulture", "cout_total",       "ALTER TABLE HistoriqueCulture ADD COLUMN cout_total DECIMAL(10,2) NULL"),
        ("HistoriqueCulture", "cout_par_gramme",  "ALTER TABLE HistoriqueCulture ADD COLUMN cout_par_gramme DECIMAL(10,4) NULL"),
        # Feature 5 — SessionConsommation créée via create_all
        # V4-A — pH & EC par arrosage
        ("ActionCalendrier", "ph_entrant",  "ALTER TABLE ActionCalendrier ADD COLUMN ph_entrant DECIMAL(4,2) NULL"),
        ("ActionCalendrier", "ph_sortant",  "ALTER TABLE ActionCalendrier ADD COLUMN ph_sortant DECIMAL(4,2) NULL"),
        ("ActionCalendrier", "ec_entrant",  "ALTER TABLE ActionCalendrier ADD COLUMN ec_entrant DECIMAL(4,2) NULL"),
        ("ActionCalendrier", "ec_sortant",  "ALTER TABLE ActionCalendrier ADD COLUMN ec_sortant DECIMAL(4,2) NULL"),
        # V4-C — Timer de flush
        ("Culture", "date_debut_flush", "ALTER TABLE Culture ADD COLUMN date_debut_flush DATE NULL"),
        # V4-F — Traçabilité stock → plante
        ("Stock", "id_plant", "ALTER TABLE Stock ADD COLUMN id_plant INT NULL REFERENCES Plant(id_plant)"),
        # Maillage Polinator — sélection dynamique depuis paramétrage
        ("HashExtraction", "maillage_polinator", "ALTER TABLE HashExtraction ADD COLUMN maillage_polinator VARCHAR(20) NULL"),
    ]
    # Créer les tables manquantes (ProduitEngrais, TemperatureLog, etc.)
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for table, column, alter_sql in migrations:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = :table AND COLUMN_NAME = :column"
            ), {"table": table, "column": column})
            if result.scalar() == 0:
                conn.execute(text(alter_sql))
        # Migration spéciale : renommer qualite_rincage → soif dans NotationVariete
        try:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'NotationVariete' AND COLUMN_NAME = 'qualite_rincage'"
            ))
            if result.scalar() > 0:
                conn.execute(text(
                    "ALTER TABLE NotationVariete RENAME COLUMN qualite_rincage TO soif"
                ))
        except Exception:
            pass
        # Migration spéciale : agrandir NotationVariete.terpene_dominant si déjà créé en VARCHAR(100)
        try:
            result = conn.execute(text(
                "SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'NotationVariete' AND COLUMN_NAME = 'terpene_dominant'"
            ))
            col_len = result.scalar()
            if col_len is not None and int(col_len) < 500:
                conn.execute(text(
                    "ALTER TABLE NotationVariete MODIFY COLUMN terpene_dominant VARCHAR(500)"
                ))
        except Exception:
            pass
        # Migration spéciale : convertir ActionCalendrier.type_action ENUM → VARCHAR(100)
        try:
            result = conn.execute(text(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'ActionCalendrier' AND COLUMN_NAME = 'type_action'"
            ))
            dt = result.scalar()
            if dt and dt.lower() == "enum":
                conn.execute(text(
                    "ALTER TABLE ActionCalendrier MODIFY COLUMN type_action VARCHAR(100) NOT NULL"
                ))
        except Exception:
            pass
        # Migration spéciale : rendre TemperatureLog.id_culture nullable (capteurs sans culture active)
        try:
            result = conn.execute(text(
                "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'TemperatureLog' AND COLUMN_NAME = 'id_culture'"
            ))
            is_nullable = result.scalar()
            if is_nullable and is_nullable.upper() == "NO":
                conn.execute(text(
                    "ALTER TABLE TemperatureLog MODIFY COLUMN id_culture INT NULL"
                ))
        except Exception:
            pass
        # Migration : convertir les tables critiques en InnoDB pour appliquer les FK
        # Sans InnoDB, les contraintes FK sont ignorées → graines orphelines possibles
        innodb_tables = ["Breeder", "Variete", "PackGraine", "Graine", "Croisement", "Pollen"]
        for tbl in innodb_tables:
            try:
                result = conn.execute(text(
                    "SELECT ENGINE FROM INFORMATION_SCHEMA.TABLES "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl"
                ), {"tbl": tbl})
                engine_type = result.scalar()
                if engine_type and engine_type.upper() != "INNODB":
                    conn.execute(text(f"ALTER TABLE {tbl} ENGINE=InnoDB"))
            except Exception:
                pass

        # Migration : supprimer les graines orphelines (id_packgraine sans pack correspondant)
        try:
            conn.execute(text(
                "DELETE g FROM Graine g "
                "LEFT JOIN PackGraine p ON g.id_packgraine = p.id_packgraine "
                "WHERE g.id_packgraine IS NOT NULL AND p.id_packgraine IS NULL"
            ))
        except Exception:
            pass

        # Migration : corriger les packs avec trop de graines (doublons dus à la réutilisation d'ID)
        # Pour chaque pack, ne conserver que les nbr_graines plus récentes (id_graine le plus élevé)
        try:
            result = conn.execute(text(
                "SELECT p.id_packgraine, p.nbr_graines, COUNT(g.id_graine) as cnt "
                "FROM PackGraine p "
                "JOIN Graine g ON g.id_packgraine = p.id_packgraine "
                "GROUP BY p.id_packgraine, p.nbr_graines "
                "HAVING cnt > p.nbr_graines"
            ))
            surplus_packs = result.fetchall()
            for row in surplus_packs:
                pack_id, nbr_attendu, cnt_actuel = row
                a_supprimer = cnt_actuel - nbr_attendu
                # Supprimer les plus anciennes graines (id_graine le plus bas)
                conn.execute(text(
                    "DELETE FROM Graine WHERE id_packgraine = :pid "
                    "ORDER BY id_graine ASC LIMIT :n"
                ), {"pid": pack_id, "n": a_supprimer})
        except Exception:
            pass

        # Migration V4-G : ajout quantite_initiale sur Stock
        try:
            result = conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Stock' "
                "AND COLUMN_NAME = 'quantite_initiale'"
            ))
            if result.fetchone() is None:
                conn.execute(text(
                    "ALTER TABLE `Stock` ADD COLUMN `quantite_initiale` DECIMAL(10,2) NULL"
                ))
        except Exception:
            pass

        conn.commit()

run_migrations()

# Seeding des valeurs par défaut des listes paramétrables + app settings
from app.database import SessionLocal as _SessionLocal
def seed_parametres():
    db = _SessionLocal()
    try:
        parametre.seed_defaults(db)
        app_settings.seed_defaults(db)
        stock_alert_seuils.seed_defaults(db)
    finally:
        db.close()

seed_parametres()

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
app.include_router(app_settings.router)
app.include_router(consommation.router)
app.include_router(photos.router)
app.include_router(stock_alert_seuils.router)
app.include_router(search.router)
app.include_router(calendrier.router)

# Fichiers statiques — photos uploadées
import os
os.makedirs("/app/uploads/photos/thumbs", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

# Démarrage du poller Govee (si APScheduler installé)
start_poller(app)


@app.get("/")
def read_root():
    """Endpoint racine"""
    return {
        "message": "Bienvenue sur l'API GrowManager",
        "version": "3.1.0",
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
