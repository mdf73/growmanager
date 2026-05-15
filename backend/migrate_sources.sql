-- Migration : ajout du champ sources (multi-produits en entrée)
-- À exécuter UNE SEULE FOIS sur la base de données existante

ALTER TABLE RosinExtraction
  ADD COLUMN sources JSON NULL
  COMMENT '[{"id_stock": int, "quantite": float}] — multi-produits en entrée'
  AFTER id_stock_source;

ALTER TABLE HashExtraction
  ADD COLUMN sources JSON NULL
  COMMENT '[{"id_stock": int, "quantite": float}] — multi-produits en entrée'
  AFTER sacs;
