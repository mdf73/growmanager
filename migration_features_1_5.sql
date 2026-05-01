-- ============================================================
-- Migration : Feature 1 (Coûts culture) + Feature 5 (Consommation)
-- Date : 2026-05-01
-- ============================================================

-- ── Feature 5 : Table SessionConsommation ────────────────────
CREATE TABLE IF NOT EXISTS `SessionConsommation` (
  `id_session`      INT          NOT NULL AUTO_INCREMENT,
  `date_heure`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `id_vaporisateur` INT          NULL,
  `type_produit`    VARCHAR(20)  NOT NULL,
  `id_stock`        INT          NULL,
  `quantite_g`      DECIMAL(6,3) NOT NULL,
  `options_vapo`    JSON         NULL,
  `notes`           TEXT         NULL,
  `created_at`      DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_session`),
  CONSTRAINT `fk_session_vapo`
    FOREIGN KEY (`id_vaporisateur`) REFERENCES `Vaporisateur` (`id_vaporisateur`) ON DELETE SET NULL,
  CONSTRAINT `fk_session_stock`
    FOREIGN KEY (`id_stock`) REFERENCES `Stock` (`id_stock`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Feature 1 : Colonnes coûts sur HistoriqueCulture ─────────
ALTER TABLE `HistoriqueCulture`
  ADD COLUMN IF NOT EXISTS `cout_engrais`      DECIMAL(10,2) NULL COMMENT '€ dépensés en engrais',
  ADD COLUMN IF NOT EXISTS `cout_electricite`  DECIMAL(10,2) NULL COMMENT '€ d''électricité',
  ADD COLUMN IF NOT EXISTS `cout_graines`      DECIMAL(10,2) NULL COMMENT '€ de graines',
  ADD COLUMN IF NOT EXISTS `cout_total`        DECIMAL(10,2) NULL COMMENT 'Somme coût total',
  ADD COLUMN IF NOT EXISTS `cout_par_gramme`   DECIMAL(10,4) NULL COMMENT '€/g récolté';
