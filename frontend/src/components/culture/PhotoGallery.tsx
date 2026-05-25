import { useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronLeft, ChevronRight, Loader2, Trash2, X, ZoomIn, Leaf } from 'lucide-react'
import { photosAPI, photoUrl, Photo } from '../../api/photos'
import { Plant } from '../../api/cultures'

// ─── Props ────────────────────────────────────────────────────────────────────
interface PhotoGalleryProps {
  idCulture?: number
  idPlant?:   number
  plants?:    Plant[]   // liste des plantes de la culture (pour sélection à l'upload)
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({
  photos,
  initialIndex,
  onClose,
  onDelete,
  getPlantName,
}: {
  photos:        Photo[]
  initialIndex:  number
  onClose:       () => void
  onDelete:      (id: number) => void
  getPlantName?: (idPlant: number | null) => string | null
}) {
  const [idx, setIdx] = useState(initialIndex)
  const photo = photos[idx]

  const prev = () => setIdx(i => Math.max(0, i - 1))
  const next = () => setIdx(i => Math.min(photos.length - 1, i + 1))

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  prev()
    if (e.key === 'ArrowRight') next()
    if (e.key === 'Escape')     onClose()
  }, [idx])

  if (!photo) return null

  const plantName = getPlantName ? getPlantName(photo.id_plant) : null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={0}
      role="dialog"
      aria-modal="true"
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
        onClick={onClose}
      >
        <X size={22} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {idx + 1} / {photos.length}
      </div>

      {/* Main image */}
      <div
        className="relative max-w-5xl max-h-[80vh] w-full flex items-center justify-center px-16"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={photoUrl(photo.filepath)}
          alt={photo.notes ?? `Photo ${idx + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Badge plante */}
      {plantName && (
        <div
          className="mt-3 flex items-center gap-1.5 bg-green-600/80 text-white text-xs px-3 py-1 rounded-full"
          onClick={e => e.stopPropagation()}
        >
          <Leaf size={12} />
          {plantName}
        </div>
      )}

      {/* Note */}
      {photo.notes && (
        <div
          className="mt-2 text-white/80 text-sm max-w-lg text-center px-4"
          onClick={e => e.stopPropagation()}
        >
          {photo.notes}
        </div>
      )}

      {/* Date + taille */}
      <div
        className="mt-1 text-white/40 text-xs"
        onClick={e => e.stopPropagation()}
      >
        {new Date(photo.date_prise).toLocaleString('fr-FR')}
        {photo.taille_ko ? ` · ${photo.taille_ko} ko` : ''}
        {photo.largeur_px && photo.hauteur_px ? ` · ${photo.largeur_px}×${photo.hauteur_px}` : ''}
      </div>

      {/* Delete */}
      <button
        className="absolute bottom-4 right-4 text-white/50 hover:text-red-400 bg-black/40 rounded-full p-2"
        onClick={e => { e.stopPropagation(); onDelete(photo.id_photo) }}
        title="Supprimer cette photo"
      >
        <Trash2 size={18} />
      </button>

      {/* Prev / Next */}
      {idx > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
          onClick={e => { e.stopPropagation(); prev() }}
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {idx < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
          onClick={e => { e.stopPropagation(); next() }}
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  )
}

// ─── Upload zone ──────────────────────────────────────────────────────────────
function UploadZone({
  onFiles,
  uploading,
}: {
  onFiles:  (files: FileList) => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors
        ${dragOver
          ? 'border-grow-400 bg-grow-50 dark:bg-grow-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-grow-300 dark:hover:border-grow-600'}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => e.target.files && onFiles(e.target.files)}
      />
      {uploading ? (
        <Loader2 size={28} className="animate-spin text-grow-500" />
      ) : (
        <Camera size={28} className="text-gray-400" />
      )}
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {uploading ? 'Upload en cours…' : 'Cliquer ou glisser des photos ici'}
      </span>
      <span className="text-xs text-gray-400">JPG, PNG, WebP · max 2 Mo par photo</span>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PhotoGallery({ idCulture, idPlant, plants = [] }: PhotoGalleryProps) {
  const qc = useQueryClient()
  const [lightboxIdx, setLightboxIdx]   = useState<number | null>(null)
  const [noteInput,   setNoteInput]     = useState('')
  const [uploading,   setUploading]     = useState(false)
  const todayStr = () => new Date().toISOString().slice(0, 10)
  const [dateInput,   setDateInput]     = useState<string>(todayStr())
  // Sélection de plante pour l'upload — 'global' = photo de toute la culture
  const [uploadTarget, setUploadTarget] = useState<'global' | string>('global')
  // Filtre d'affichage — 'all' | 'global' | plant id (string)
  const [filterTarget, setFilterTarget] = useState<'all' | 'global' | string>('all')

  // En mode plante unique (vue détail plante), pas de sélecteur
  const isSinglePlant = idPlant !== undefined
  // Toutes les plantes triées par ordre alphabétique
  const sortedPlants = [...plants].sort((a, b) => a.nom_affichage.localeCompare(b.nom_affichage, 'fr'))

  const queryKey = ['photos', idCulture, idPlant]

  const { data: photos = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => photosAPI.list({
      ...(idCulture !== undefined && { id_culture: idCulture }),
      ...(idPlant   !== undefined && { id_plant:   idPlant }),
    }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => photosAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['photos-count', idCulture] })
      setLightboxIdx(null)
    },
  })

  // ── Résolution du nom d'une plante par son id ────────────────────────────
  const getPlantName = (plantId: number | null): string | null => {
    if (!plantId || plants.length === 0) return null
    const p = plants.find(pl => pl.id_plant === plantId)
    return p?.nom_affichage ?? null
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleFiles = async (files: FileList) => {
    setUploading(true)
    try {
      // Résolution de la cible de l'upload
      const resolvedPlantId = (!isSinglePlant && uploadTarget !== 'global')
        ? Number(uploadTarget)
        : idPlant   // undefined si vue culture globale + global sélectionné

      for (const file of Array.from(files)) {
        await photosAPI.upload({
          file,
          ...(idCulture          !== undefined && { id_culture: idCulture }),
          ...(resolvedPlantId    !== undefined && { id_plant:   resolvedPlantId }),
          notes:      noteInput || undefined,
          date_prise: dateInput || todayStr(),
        })
      }
      setNoteInput('')
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['photos-count', idCulture] })
    } finally {
      setUploading(false)
    }
  }

  // ── Filtrage des photos ──────────────────────────────────────────────────
  const filteredPhotos = (() => {
    if (filterTarget === 'all')    return photos
    if (filterTarget === 'global') return photos.filter(p => p.id_plant === null)
    return photos.filter(p => p.id_plant === Number(filterTarget))
  })()

  // Index lightbox dans filteredPhotos → index global pour la lightbox
  const handleOpenLightbox = (filteredIdx: number) => {
    setLightboxIdx(filteredIdx)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  // Compte par filtre pour les badges
  const countGlobal = photos.filter(p => p.id_plant === null).length
  const countByPlant = (plantId: number) => photos.filter(p => p.id_plant === plantId).length

  return (
    <div className="space-y-6">
      {/* ── Zone upload ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Ligne date + note */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Date de la photo
            </label>
            <input
              type="date"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Sélecteur de cible — uniquement en vue culture (pas en vue plante) */}
          {!isSinglePlant && plants.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Associer à
              </label>
              <select
                value={uploadTarget}
                onChange={e => setUploadTarget(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="global">🌿 Toute la culture</option>
                {sortedPlants.map(p => (
                  <option key={p.id_plant} value={p.id_plant}>
                    🌱 {p.nom_affichage}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="text"
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            placeholder="Note optionnelle pour les prochaines photos…"
            className="flex-1 min-w-[160px] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>

        {/* Info sur la cible sélectionnée */}
        {!isSinglePlant && plants.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 pl-0.5">
            {uploadTarget === 'global'
              ? '📷 Les photos seront associées à la culture entière (aucune plante spécifique)'
              : `📷 Les photos seront associées à "${plants.find(p => String(p.id_plant) === uploadTarget)?.nom_affichage}" et à la culture`
            }
          </p>
        )}

        <UploadZone onFiles={handleFiles} uploading={uploading} />
      </div>

      {/* ── Filtres de la galerie ──────────────────────────────────────────── */}
      {!isSinglePlant && photos.length > 0 && plants.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterTarget('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filterTarget === 'all'
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          >
            Toutes ({photos.length})
          </button>
          <button
            onClick={() => setFilterTarget('global')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1
              ${filterTarget === 'global'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'}`}
          >
            🌿 Culture ({countGlobal})
          </button>
          {plants.map(p => {
            const cnt = countByPlant(p.id_plant)
            if (cnt === 0) return null
            return (
              <button
                key={p.id_plant}
                onClick={() => setFilterTarget(String(p.id_plant))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1
                  ${filterTarget === String(p.id_plant)
                    ? 'bg-green-600 text-white'
                    : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'}`}
              >
                🌱 {p.nom_affichage} ({cnt})
              </button>
            )
          })}
        </div>
      )}

      {/* ── Galerie ────────────────────────────────────────────────────────── */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {photos.length === 0 ? "Aucune photo pour l'instant" : 'Aucune photo pour ce filtre'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredPhotos.map((photo, i) => {
            const plantName = getPlantName(photo.id_plant)
            return (
              <div
                key={photo.id_photo}
                className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer"
                onClick={() => handleOpenLightbox(i)}
              >
                <img
                  src={photo.thumbnail_path ? photoUrl(photo.thumbnail_path) : photoUrl(photo.filepath)}
                  alt={photo.notes ?? `Photo ${i + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Bouton suppression */}
                <button
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-red-600 text-white rounded-full p-1.5 z-10"
                  title="Supprimer"
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm('Supprimer cette photo ?')) deleteMut.mutate(photo.id_photo)
                  }}
                >
                  <Trash2 size={14} />
                </button>
                {/* Badge plante (uniquement en vue culture) */}
                {!isSinglePlant && plantName && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-green-600/85 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium z-10 max-w-[70%] truncate">
                    <Leaf size={9} className="shrink-0" />
                    <span className="truncate">{plantName}</span>
                  </div>
                )}
                {/* Date + Note badge */}
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs truncate">
                  <span className="opacity-70">
                    {new Date(photo.date_prise).toLocaleDateString('fr-FR')}
                  </span>
                  {photo.notes && <span className="ml-1">· {photo.notes}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          photos={filteredPhotos}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDelete={id => deleteMut.mutate(id)}
          getPlantName={getPlantName}
        />
      )}
    </div>
  )
}
