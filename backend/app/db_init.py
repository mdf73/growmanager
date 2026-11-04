"""Initialisation de la base : création des tables, migrations, seeds.

Exécutée UNE seule fois au démarrage :
- en production (Dockerfile.prod) : `python -m app.db_init` avant de lancer uvicorn,
  puis les 2 workers démarrent avec GM_SKIP_DB_INIT=1 et ne touchent pas au schéma ;
- en dev (un seul process, --reload) : appelée directement par app/main.py.

Évite la course entre les workers uvicorn (bugs/tapoconfig-migration-race,
bugs/parametres-doublons-seed-workers dans le wiki).
"""
from sqlalchemy import text
from app.database import Base, engine, SessionLocal as _SessionLocal
import app.models  # noqa: F401 (enregistre tous les modèles sur Base)
from app.routers import parametre, app_settings, stock_alert_seuils


# Migration: ajout des nouvelles colonnes si elles n'existent pas
# Utilise INFORMATION_SCHEMA car MySQL ne supporte pas ADD COLUMN IF NOT EXISTS
def _backfill_historique_id_culture(conn):
    """Rattache chaque archive HistoriqueCulture à sa culture d'origine.
    Critère : même date de début et même nombre de plantes (plantes non abandonnées
    côté Culture = lignes HistoriquePlant). Rattachement uniquement si le candidat est unique."""
    hists = conn.execute(text(
        "SELECT h.id_historique_culture, h.date_debut, COUNT(p.id_historique_plant) "
        "FROM HistoriqueCulture h LEFT JOIN HistoriquePlant p "
        "ON p.id_historique_culture = h.id_historique_culture "
        "WHERE h.id_culture IS NULL GROUP BY h.id_historique_culture, h.date_debut"
    )).fetchall()
    cultures = conn.execute(text(
        "SELECT c.id_culture, c.date_debut, "
        "SUM(CASE WHEN p.statut <> 'abandonne' THEN 1 ELSE 0 END) "
        "FROM Culture c JOIN Plant p ON p.id_culture = c.id_culture "
        "GROUP BY c.id_culture, c.date_debut"
    )).fetchall()
    used = set()
    for id_h, d_h, n_h in hists:
        cands = [c for c in cultures
                 if c[0] not in used and c[1] == d_h and int(c[2] or 0) == int(n_h or 0) and n_h]
        if len(cands) == 1:
            used.add(cands[0][0])
            conn.execute(text(
                "UPDATE HistoriqueCulture SET id_culture = :c WHERE id_historique_culture = :h"
            ), {"c": cands[0][0], "h": id_h})


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
        ("RosinExtraction",  "id_stock_produit",  "ALTER TABLE RosinExtraction ADD COLUMN id_stock_produit INT"),
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
        ("GoveeDevice",   "source",     "ALTER TABLE GoveeDevice ADD COLUMN source VARCHAR(20) NULL"),
        # Stock — sortie de stock + bocal Materiel + substrat
        ("Stock", "date_fin_stock",    "ALTER TABLE Stock ADD COLUMN date_fin_stock DATE NULL"),
        ("Stock", "id_materiel_bocal", "ALTER TABLE Stock ADD COLUMN id_materiel_bocal INT NULL REFERENCES Materiel(id_materiel)"),
        ("Stock", "substrat_type",     "ALTER TABLE Stock ADD COLUMN substrat_type VARCHAR(200) NULL"),
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
        # Clonage — suivi bouture
        ("Plant", "id_plant_mere",    "ALTER TABLE Plant ADD COLUMN id_plant_mere INT NULL REFERENCES Plant(id_plant) ON DELETE SET NULL"),
        ("Plant", "date_prelevement", "ALTER TABLE Plant ADD COLUMN date_prelevement DATE NULL"),
        ("Plant", "date_enracinement","ALTER TABLE Plant ADD COLUMN date_enracinement DATE NULL"),
        ("Plant", "statut_clone",     "ALTER TABLE Plant ADD COLUMN statut_clone VARCHAR(20) NULL"),
        # Croisement Open Field — tables créées via create_all (ProjetOpenField, PlanteMereOpenField, PlantePereOpenField)
        ("PlanteMereOpenField", "id_peres", "ALTER TABLE PlanteMereOpenField ADD COLUMN id_peres JSON NULL"),
        # Refonte classement variétés — notes sur 5 étoiles
        ("NotationVariete", "note_gout",       "ALTER TABLE NotationVariete ADD COLUMN note_gout FLOAT NULL"),
        ("NotationVariete", "note_odeur",      "ALTER TABLE NotationVariete ADD COLUMN note_odeur FLOAT NULL"),
        ("NotationVariete", "note_texture",    "ALTER TABLE NotationVariete ADD COLUMN note_texture FLOAT NULL"),
        ("NotationVariete", "note_extraction", "ALTER TABLE NotationVariete ADD COLUMN note_extraction FLOAT NULL"),
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

        # Refonte classement variétés : suppression des anciens critères de notation (/100)
        for old_col in ("vigueur_sante", "productivite_structure", "soif", "apparence_structure",
                        "profil_aromatique", "saveur_qualite", "effet_puissance"):
            try:
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() "
                    "AND TABLE_NAME = 'NotationVariete' AND COLUMN_NAME = :col"
                ), {"col": old_col})
                if result.scalar() > 0:
                    conn.execute(text(f"ALTER TABLE NotationVariete DROP COLUMN {old_col}"))
            except Exception:
                pass

        # Refonte classement variétés : HistoriqueCulture.id_culture + rattachement des archives existantes
        # (une archive auto doublonne les plantes de la culture d'origine → il faut pouvoir l'exclure)
        try:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'HistoriqueCulture' AND COLUMN_NAME = 'id_culture'"
            ))
            if result.scalar() == 0:
                conn.execute(text("ALTER TABLE HistoriqueCulture ADD COLUMN id_culture INT NULL"))
                _backfill_historique_id_culture(conn)
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

        # Migration : doublons ParametreListeValeur (v3.8.0). Les 2 workers uvicorn ont
        # seedé en parallèle les nouvelles listes vides → chaque valeur insérée 2 fois.
        # On garde la plus ancienne ligne, puis un index unique empêche toute récidive.
        try:
            conn.execute(text(
                "DELETE p1 FROM `ParametreListeValeur` p1 "
                "JOIN `ParametreListeValeur` p2 "
                "ON p1.liste_nom = p2.liste_nom AND p1.valeur = p2.valeur "
                "AND p1.id_parametre > p2.id_parametre"
            ))
            conn.commit()
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ParametreListeValeur' "
                "AND INDEX_NAME = 'uq_parametre_liste_valeur'"
            ))
            if result.scalar() == 0:
                conn.execute(text(
                    "CREATE UNIQUE INDEX uq_parametre_liste_valeur "
                    "ON `ParametreListeValeur` (liste_nom, valeur)"
                ))
        except Exception:
            pass  # l'autre worker a pu créer l'index entre-temps

        # Migration : compatibilités vapo, clés techniques → libellés (liste paramétrable
        # `vapo_compatibilites`). Idempotent : les libellés ne contiennent plus les clés.
        try:
            conn.execute(text(
                "UPDATE `Vaporisateur` SET compatibilites = "
                "REPLACE(REPLACE(REPLACE(compatibilites, "
                "'fleurs_sechees', 'Fleurs séchées'), "
                "'concentres', 'Concentrés (Rosin)'), "
                "'resines', 'Résines') "
                "WHERE compatibilites REGEXP 'fleurs_sechees|concentres|resines'"
            ))
        except Exception:
            pass

        conn.commit()


# Seeding des valeurs par défaut des listes paramétrables + app settings
def seed_parametres():
    db = _SessionLocal()
    try:
        parametre.seed_defaults(db)
        parametre.migrer_fournisseurs_vers_liste(db)
        app_settings.seed_defaults(db)
        stock_alert_seuils.seed_defaults(db)
    finally:
        db.close()


def seed_culture_emplacements():
    """Affectation initiale = espace actuel à date_debut. Aucun déplacement inventé."""
    from datetime import date as _date
    from app.models import Culture, CultureEmplacement
    db = _SessionLocal()
    try:
        cultures = db.query(Culture).filter(Culture.id_espace.isnot(None)).all()
        for c in cultures:
            exists = (
                db.query(CultureEmplacement)
                .filter(CultureEmplacement.id_culture == c.id_culture)
                .first()
            )
            if exists:
                continue
            db.add(CultureEmplacement(
                id_culture=c.id_culture,
                id_espace=c.id_espace,
                date_debut=c.date_debut or _date.today(),
                date_fin=None,
            ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def init_database():
    """Crée les tables manquantes, applique les migrations et les seeds."""
    run_migrations()  # inclut Base.metadata.create_all()
    seed_parametres()
    seed_culture_emplacements()


if __name__ == "__main__":
    init_database()
    print("[db_init] Base initialisée")
