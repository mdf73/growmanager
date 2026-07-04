---
type: domain
updated: 2026-07-04
---

# 🌡️ Capteurs & Environnement

Suivi température, humidité et VPD via les capteurs Govee.

## Ce que ça fait

- **Suivi des constantes** — courbes température/humidité/VPD par capteur ou agrégées, fenêtres 6h/24h/48h/7j/30j. Page `/suivi-constantes`.
- **Dashboard** — statut des capteurs Govee, T°/humidité moyennes affichées dans les modules Séchage/Curing.
- **Courbes du jour** — intégrées dans le calendrier culture et le calendrier global (`SensorDayChart`), filtrées par espace.

## Détails techniques

- [[features/sensor-integration]] — setup Govee H5179, polling, calcul VPD, saisies manuelles
- [[database/database-sensors]] — GoveeDevice, TemperatureLog, calcul VPD
- Endpoints capteurs regroupés dans le router `capteurs.py` — voir [[api/api-infrastructure]]

## Voir aussi

- [[domains/metier-cultures]] — courbes capteurs affichées dans le calendrier de culture
- [[domains/metier-equipement-espaces]] — capteurs rattachés à un espace de culture
