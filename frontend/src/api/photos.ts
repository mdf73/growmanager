import axios from 'axios'
import client from './client'

export interface Photo {
  id_photo:       number
  filename:       string
  filepath:       string
  thumbnail_path: string | null
  date_prise:     string
  notes:          string | null
  id_plant:       number | null
  id_culture:     number | null
  taille_ko:      number | null
  largeur_px:     number | null
  hauteur_px:     number | null
  created_at:     string | null
}

export function photoUrl(relativePath: string): string {
  return `/uploads/${relativePath}`
}

export const photosAPI = {
  list(params: { id_culture?: number; id_plant?: number }): Promise<Photo[]> {
    return client.get<Photo[]>('/photos/', { params }).then(r => r.data)
  },

  upload(payload: {
    file:        File
    id_culture?: number
    id_plant?:   number
    notes?:      string
    date_prise?: string   // format "YYYY-MM-DD"
  }): Promise<Photo> {
    const fd = new FormData()
    fd.append('file', payload.file)
    if (payload.id_culture !== undefined) fd.append('id_culture', String(payload.id_culture))
    if (payload.id_plant   !== undefined) fd.append('id_plant',   String(payload.id_plant))
    if (payload.notes)                    fd.append('notes',       payload.notes)
    if (payload.date_prise)               fd.append('date_prise',  payload.date_prise)
    return axios.post<Photo>('/api/photos/upload', fd).then(r => r.data)
  },

  delete(id: number): Promise<void> {
    return client.delete(`/photos/${id}`).then(() => undefined)
  },
}
