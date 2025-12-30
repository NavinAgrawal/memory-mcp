/**
 * Features Module Barrel Export
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
// Note: CompressionManager functionality merged into SearchManager (Sprint 11.1)
// Note: AnalyticsManager functionality merged into SearchManager (Sprint 11.2)
// Note: ArchiveManager functionality merged into EntityManager (Sprint 11.3)
// Note: BackupManager, ExportManager, ImportManager merged into IOManager (Sprint 11.4)
// Note: ArchiveCriteria and ArchiveResult types now exported from core/EntityManager
// Note: ExportFilter type moved to types/import-export.types.ts
