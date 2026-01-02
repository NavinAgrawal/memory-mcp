/**
 * Features Module Barrel Export
 * Phase 4: Re-extracted specialized managers for single responsibility
 */

export { TagManager } from './TagManager.js';
export {
  IOManager,
  type ExportFormat,
  type ImportFormat,
  type MergeStrategy,
  type BackupMetadata,
  type BackupInfo,
} from './IOManager.js';
export { AnalyticsManager } from './AnalyticsManager.js';
export { CompressionManager } from './CompressionManager.js';
export {
  ArchiveManager,
  type ArchiveCriteria,
  type ArchiveOptions,
  type ArchiveResult,
} from './ArchiveManager.js';
