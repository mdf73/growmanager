-- Migration : mise à jour de la table Stock pour les nouvelles installations
-- À exécuter UNE SEULE FOIS si vous avez installé GrowManager depuis le code source GitHub
-- sans avoir effectué les migrations précédentes.
--
-- Symptôme : "Unknown column 'Stock.substrat_type' in 'field list'" dans les logs backend

-- Ajout des colonnes manquantes (ignorées si elles existent déjà)

ALTER TABLE Stock
  ADD COLUMN IF NOT EXISTS id_materiel_bocal INT NULL,
  ADD COLUMN IF NOT EXISTS id_plant INT NULL,
  ADD COLUMN IF NOT EXISTS lampe_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS engrais_type VARCHAR(200) NULL COMMENT 'marques des engrais utilisés',
  ADD COLUMN IF NOT EXISTS substrat_type VARCHAR(200) NULL COMMENT 'substrat (coco, sol vivant...)',
  ADD COLUMN IF NOT EXISTS maillage VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS type_hash VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS type_rosin VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS date_fin_stock DATE NULL COMMENT 'date de clôture (sortie manuelle ou stock=0)',
  ADD COLUMN IF NOT EXISTS quantite_initiale DECIMAL(10,2) NULL COMMENT 'quantité à la création (pour calcul % restant)';

-- Ajout des foreign keys si les tables cibles existent
-- (MySQL ignore silencieusement les FK déjà existantes via IF NOT EXISTS n'est pas supporté pour FK,
--  donc on utilise une approche conditionnelle)

-- FK vers Materiel
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Stock'
    AND COLUMN_NAME = 'id_materiel_bocal'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE Stock ADD CONSTRAINT fk_stock_materiel FOREIGN KEY (id_materiel_bocal) REFERENCES Materiel(id_materiel)',
  'SELECT "FK fk_stock_materiel already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK vers Plant
SET @fk_exists2 = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Stock'
    AND COLUMN_NAME = 'id_plant'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);
SET @sql2 = IF(@fk_exists2 = 0,
  'ALTER TABLE Stock ADD CONSTRAINT fk_stock_plant FOREIGN KEY (id_plant) REFERENCES Plant(id_plant)',
  'SELECT "FK fk_stock_plant already exists"'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SELECT 'Migration terminée avec succès !' AS status;
