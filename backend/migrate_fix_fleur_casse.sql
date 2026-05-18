-- Migration : corriger la casse de type_stock "fleur" → "Fleur"
-- Bug : le passage curing→stock créait des entrées avec type_stock="fleur" (minuscule)
-- au lieu de "Fleur" (majuscule) comme les autres entrées de stock de fleur.

UPDATE stock
SET type_stock = 'Fleur'
WHERE type_stock = 'fleur';

-- Vérification
SELECT COUNT(*) as nb_corrigees FROM stock WHERE type_stock = 'Fleur';
SELECT COUNT(*) as nb_restantes_minuscule FROM stock WHERE type_stock = 'fleur';
