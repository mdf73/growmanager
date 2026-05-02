import { useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronLeft, ChevronRight, Loader2, Trash2, X, ZoomIn } from 'lucide-react'
import { photosAPI, photoUrl, Photo } from '../../api/photos'

// ─── Props ────────────────────────────────────────────────────────────────────
interface PhotoGalleryProps {
  idCulture?: number
  idPlant?:   number
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({
  photos,
  initialIndex,
  onClose,
  onDelete,
}: {
  photos:       Photo[]
  initialIndex: number
  onClose:      () => void
  onDelete:     (id: number) => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const photo = photos[idx]

  const prev = () => setIdx(i => Math.max(0, i - 1))
  const next = () => setIdx(i => Math.min(photos.length - 1, i + 1))

  // Keyboard nav
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  prev()
    if (e.key === 'ArrowRight') next()
    if (e.key === 'Escape')     onClose()
  }, [idx])

  if (!photo) return null

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

      {/* Note */}
      {photo.notes && (
        <div
          className="mt-4 text-white/80 text-sm max-w-lg text-center px-4"
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
export default function PhotoGallery({ idCulture, idPlant }: PhotoGalleryProps) {
  const qc = useQueryClient()
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [noteInput,   setNoteInput]   = useState('')
  const [uploading,   setUploading]   = useState(false)

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

  const handleFiles = async (files: FileList) => {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await photosAPI.upload({
          file,
          ...(idCulture !== undefined && { id_culture: idCulture }),
          ...(idPlant   !== undefined && { id_plant:   idPlant }),
          notes: noteInput || undefined,
        })
      }
      setNoteInput('')
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['photos-count', idCulture] })
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Zone upload */}
      <div className="space-y-2">
        <input
          type="text"
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          placeholder="Note optionnelle pour les prochaines photos…"
          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
        />
        <UploadZone onFiles={handleFiles} uploading={uploading} />
      </div>

      {/* Galerie */}
      {photos.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Aucune photo pour l'instant
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, i) => (
            <div
              key={photo.id_photo}
              className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer"
              onClick={() => setLightboxIdx(i)}
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
              {/* Bouton suppression sur miniature */}
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
              {/* Note badge */}
              {photo.notes && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs truncate">
                  {photo.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDelete={id => deleteMut.mutate(id)}
        />
      )}
    </div>
  )
}
