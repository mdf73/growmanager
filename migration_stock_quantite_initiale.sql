-- Migration : ajout de quantite_initiale sur la table Stock
-- Feature G — Alertes stock bas
-- Date : 2026-05-13

ALTER TABLE Stock
  ADD COLUMN IF NOT EXISTS quantite_initiale DECIMAL(10,2) NULL
  COMMENT 'Quantité à la création de l''entrée stock (sert au calcul % restant pour les alertes)';

-- Rétro-remplissage optionnel : on initialise avec la quantite_stock courante
-- pour les entrées existantes (à ajuster manuellement si nécessaire)
UPDATE Stock
SET quantite_initiale = quantite_stock
WHERE quantite_initiale IS NULL;
