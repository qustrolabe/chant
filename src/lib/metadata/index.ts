import { itunesService } from './itunes';
import { musicbrainzService } from './musicbrainz';

export type { MetadataService, MetadataQuery, MetadataResult, SearchType } from './types';

export const SERVICES = [itunesService, musicbrainzService];
