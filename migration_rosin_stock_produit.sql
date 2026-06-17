-- Migration : ajout de id_stock_produit sur la table RosinExtraction
-- Permet de lier une extraction au stock Rosin qu'elle a produit,
-- afin de synchroniser le stock lors de l'édition (quantité + maillage).
-- Date : 2026-06-17

ALTER TABLE RosinExtraction
  ADD COLUMN IF NOT EXISTS id_stock_produit INT NULL
  COMMENT 'FK vers le Stock Rosin produit par cette extraction (sync édition)';

-- Clé étrangère (optionnelle, best-effort si la contrainte n'existe pas déjà)
-- ALTER TABLE RosinExtraction
--   ADD CONSTRAINT fk_rosin_stock_produit
--   FOREIGN KEY (id_stock_produit) REFERENCES Stock(id_stock);
