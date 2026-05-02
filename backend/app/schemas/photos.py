"""Schémas Pydantic pour Photo (Feature 8 — Galerie photos)"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PhotoRead(BaseModel):
    id_photo:       int
    filename:       str
    filepath:       str            # relatif → le frontend préfixe avec /uploads/
    thumbnail_path: Optional[str]  # relatif → le frontend préfixe avec /uploads/
    date_prise:     datetime
    notes:          Optional[str]
    id_plant:       Optional[int]
    id_culture:     Optional[int]
    taille_ko:      Optional[int]
    largeur_px:     Optional[int]
    hauteur_px:     Optional[int]
    created_at:     Optional[datetime]

    class Config:
        from_attributes = True
