"""Router Photos — upload, liste, suppression (Feature 8 — Galerie photos)"""
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import Photo
from app.schemas.photos import PhotoRead

# ── Pillow pour compression + thumbnails ──────────────────────────────────────
try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

router = APIRouter(prefix="/api/photos", tags=["photos"])

# ── Chemins de stockage ───────────────────────────────────────────────────────
UPLOADS_DIR = "/app/uploads/photos"
THUMBS_DIR  = "/app/uploads/photos/thumbs"
MAX_SIZE_BYTES = 2 * 1024 * 1024   # 2 Mo
THUMB_SIZE     = (300, 300)
ALLOWED_TYPES  = {"image/jpeg", "image/png", "image/webp", "image/heic"}


def _ensure_dirs():
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    os.makedirs(THUMBS_DIR,  exist_ok=True)


def _safe_filename(original: str) -> str:
    """Génère un nom de fichier unique basé sur un UUID, en conservant l'extension."""
    ext = os.path.splitext(original)[-1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".heic"):
        ext = ".jpg"
    return f"{uuid.uuid4().hex}{ext}"


def _process_image(src_path: str, dest_path: str, thumb_path: str) -> dict:
    """
    Ouvre l'image, la compresse si > 2 Mo, génère un thumbnail 300×300.
    Retourne {"taille_ko", "largeur_px", "hauteur_px"}.
    """
    if not PILLOW_AVAILABLE:
        size_ko = os.path.getsize(src_path) // 1024
        return {"taille_ko": size_ko, "largeur_px": None, "hauteur_px": None}

    with Image.open(src_path) as img:
        # Normalise la rotation EXIF
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Conversion en RGB si nécessaire (PNG RGBA, etc.)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        w, h = img.size

        # Sauvegarde principale — compression JPEG progressive
        quality = 85
        img.save(dest_path, "JPEG", quality=quality, optimize=True, progressive=True)

        # Si toujours > 2 Mo, on réduit la qualité
        while os.path.getsize(dest_path) > MAX_SIZE_BYTES and quality > 40:
            quality -= 10
            img.save(dest_path, "JPEG", quality=quality, optimize=True, progressive=True)

        # Thumbnail carré 300×300 (crop centré)
        img_thumb = img.copy()
        img_thumb.thumbnail((300, 300))
        # Crop centré
        tw, th = img_thumb.size
        left   = max(0, (tw - 300) // 2)
        top    = max(0, (th - 300) // 2)
        right  = min(tw, left + 300)
        bottom = min(th, top + 300)
        img_thumb = img_thumb.crop((left, top, right, bottom))
        img_thumb.save(thumb_path, "JPEG", quality=80, optimize=True)

    taille_ko = os.path.getsize(dest_path) // 1024
    return {"taille_ko": taille_ko, "largeur_px": w, "hauteur_px": h}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PhotoRead])
def get_photos(
    id_culture: Optional[int] = Query(None),
    id_plant:   Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Retourne les photos d'une culture ou d'une plante (tri chronologique desc)."""
    q = db.query(Photo)
    if id_culture is not None:
        q = q.filter(Photo.id_culture == id_culture)
    if id_plant is not None:
        q = q.filter(Photo.id_plant == id_plant)
    return q.order_by(Photo.date_prise.desc()).all()


@router.post("/upload", response_model=PhotoRead, status_code=201)
async def upload_photo(
    file:       UploadFile = File(...),
    id_culture: Optional[int] = Form(None),
    id_plant:   Optional[int] = Form(None),
    notes:      Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload une photo, la compresse et génère un thumbnail."""
    _ensure_dirs()

    # Lecture du contenu
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")

    # Nom unique
    safe_name  = _safe_filename(file.filename or "photo.jpg")
    # Force extension .jpg en sortie (on réencode toujours en JPEG)
    base_name  = os.path.splitext(safe_name)[0] + ".jpg"
    thumb_name = "thumb_" + base_name

    src_path   = os.path.join(UPLOADS_DIR, "tmp_" + base_name)
    dest_path  = os.path.join(UPLOADS_DIR, base_name)
    thumb_path = os.path.join(THUMBS_DIR,  thumb_name)

    # Écriture du fichier source
    with open(src_path, "wb") as f:
        f.write(content)

    # Traitement
    try:
        meta = _process_image(src_path, dest_path, thumb_path)
    except Exception as e:
        # En cas d'erreur Pillow, on conserve le fichier brut
        import shutil
        shutil.copy(src_path, dest_path)
        meta = {"taille_ko": len(content) // 1024, "largeur_px": None, "hauteur_px": None}
        thumb_path_rel = None
    finally:
        if os.path.exists(src_path):
            os.remove(src_path)

    # Chemins relatifs stockés en DB (le frontend préfixe avec /uploads/)
    filepath_rel   = f"photos/{base_name}"
    thumb_rel      = f"photos/thumbs/{thumb_name}" if os.path.exists(thumb_path) else None

    photo = Photo(
        filename       = base_name,
        filepath       = filepath_rel,
        thumbnail_path = thumb_rel,
        date_prise     = datetime.utcnow(),
        notes          = notes,
        id_plant       = id_plant,
        id_culture     = id_culture,
        taille_ko      = meta.get("taille_ko"),
        largeur_px     = meta.get("largeur_px"),
        hauteur_px     = meta.get("hauteur_px"),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    """Supprime la photo (fichier + thumbnail + entrée DB)."""
    photo = db.query(Photo).filter(Photo.id_photo == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo introuvable")

    # Suppression des fichiers
    for rel_path in (photo.filepath, photo.thumbnail_path):
        if rel_path:
            full_path = os.path.join("/app/uploads", rel_path)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except OSError:
                    pass

    db.delete(photo)
    db.commit()
