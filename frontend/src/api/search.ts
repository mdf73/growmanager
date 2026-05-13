import client from './client'

export interface SearchResult {
  id: number
  label: string
  sub: string
  url: string
}

export interface SearchResults {
  cultures: SearchResult[]
  plantes: SearchResult[]
  varietes: SearchResult[]
  breeders: SearchResult[]
  stock: SearchResult[]
}

export const searchAPI = {
  search: async (q: string): Promise<SearchResults> => {
    const { data } = await client.get<SearchResults>('/search', { params: { q } })
    return data
  },
}
