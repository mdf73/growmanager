"""
Script de nettoyage — Option B
Supprime les plantes récoltées (statut 'prete' ou 'recolte').
Les ActionCalendrier liées sont supprimées automatiquement (CASCADE).

Usage :
    docker compose exec backend python /app/cleanup_production.py
"""

import sys
from sqlalchemy import create_engine, text

DATABASE_URL = "mysql+pymysql://grow:grow2024@db:3306/growmanager"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT COUNT(*) FROM Plant WHERE statut IN ('prete', 'recolte')"
    ))
    nb = result.scalar()

    if nb == 0:
        print("✅ Aucune plante récoltée trouvée — rien à supprimer.")
        sys.exit(0)

    print(f"⚠️  {nb} plante(s) avec statut 'prete' ou 'recolte' vont être supprimées.")
    confirm = input("Confirmer ? (oui/non) : ").strip().lower()

    if confirm != "oui":
        print("❌ Annulé.")
        sys.exit(0)

    conn.execute(text(
        "DELETE FROM Plant WHERE statut IN ('prete', 'recolte')"
    ))

    conn.commit()
    print(f"✅ {nb} plante(s) supprimée(s) avec succès.")
    print("   → Le module Production du dashboard affichera maintenant 0 g.")
