-- Migration : ajout du champ maillage_polinator sur HashExtraction
-- Permet de stocker le maillage utilisé lors d'une extraction Polinator

ALTER TABLE HashExtraction
  ADD COLUMN maillage_polinator VARCHAR(20) NULL;
