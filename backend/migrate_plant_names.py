"""
Migration one-shot : recalcule le nom_affichage de toutes les plantes
liées à une graine, en remplaçant #{id_graine_global} par #{rang_dans_paquet}.

Lancer depuis le container backend :
    python migrate_plant_names.py
Ou depuis la racine du projet :
    docker compose exec backend python migrate_plant_names.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models import Plant, Graine

db = SessionLocal()

try:
    plants = db.query(Plant).filter(Plant.id_graine.isnot(None)).all()
    updated = 0
    skipped = 0

    for plant in plants:
        graine = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
        if not graine or not graine.variete or not graine.id_packgraine:
            skipped += 1
            continue

        # Rang 1-based de la graine dans son paquet (trié par id_graine)
        ids_in_pack = [
            r[0] for r in db.query(Graine.id_graine)
            .filter(Graine.id_packgraine == graine.id_packgraine)
            .order_by(Graine.id_graine)
            .all()
        ]
        rank = ids_in_pack.index(graine.id_graine) + 1 if graine.id_graine in ids_in_pack else None
        if rank is None:
            skipped += 1
            continue

        new_name = f"{graine.variete.nom_variete} #{rank}"
        if plant.nom_affichage != new_name:
            print(f"  Plant #{plant.id_plant}: \"{plant.nom_affichage}\" → \"{new_name}\"")
            plant.nom_affichage = new_name
            updated += 1

    db.commit()
    print(f"\n✅ Migration terminée — {updated} plante(s) renommée(s), {skipped} ignorée(s).")

except Exception as e:
    db.rollback()
    print(f"❌ Erreur : {e}")
    raise
finally:
    db.close()
