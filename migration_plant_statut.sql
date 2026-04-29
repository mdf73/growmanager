-- Migration : Plant.statut → VARCHAR(50) pour supporter les nouveaux stades curing / prete
-- À exécuter UNE SEULE FOIS sur votre base de données MySQL GrowManager
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE Plant
  MODIFY statut VARCHAR(50) DEFAULT 'germination'
    COMMENT 'germination | veg | floraison | sechage | curing | prete | recolte | abandonne';

-- Vérification
-- SELECT DISTINCT statut FROM Plant;
