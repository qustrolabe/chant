export type SearchType = 'track' | 'album' | 'artist';

export interface MetadataQuery {
  text: string;
  type: SearchType;
}

export interface MetadataResult {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  year?: number;
  coverUrl?: string;
  raw: unknown;
}

export interface MetadataService {
  id: string;
  name: string;
  description: string;
  supportsTypes: SearchType[];
  search: (query: MetadataQuery) => Promise<MetadataResult[]>;
}
