import { itunesService } from './itunes';
import { musicbrainzService } from './musicbrainz';
import { lrclibService } from './lrclib';

export type { MetadataService, MetadataQuery, MetadataResult, SearchType } from './types';

export const SERVICES = [itunesService, musicbrainzService, lrclibService];
