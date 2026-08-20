import { getRepository } from '@server/datasource';
import MediaMetadata from '@server/entity/MediaMetadata';
import logger from '@server/logger';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';

/**
 * Automatic backups: a zip of everything needed to restore the instance's
 * brain — a consistent SQLite snapshot (VACUUM INTO, SQLite's online-backup
 * idiom) plus settings.json. Poster/image caches are re-fetchable and
 * excluded. A daily job writes to <config>/backups and keeps the newest
 * BACKUP_KEEP files; the settings UI can trigger and download them.
 *
 * Postgres deployments are skipped (use pg_dump there) — this instance
 * targets the default SQLite.
 */

const CONFIG_DIR = process.env.CONFIG_DIRECTORY
  ? process.env.CONFIG_DIRECTORY
  : path.join(process.cwd(), 'config');

const BACKUP_DIR = path.join(CONFIG_DIR, 'backups');
const SETTINGS_PATH = path.join(CONFIG_DIR, 'settings.json');

const BACKUP_KEEP = Number(process.env.BACKUP_KEEP) > 0
  ? Number(process.env.BACKUP_KEEP)
  : 14;

const NAME_RE = /^backup-\d{8}-\d{6}\.zip$/;

class BackupManager {
  public running = false;

  public status() {
    return { running: this.running };
  }

  public cancel() {
    // a backup is short and atomic; nothing sensible to cancel
  }

  public async listBackups(): Promise<{ name: string; size: number; createdAt: Date }[]> {
    try {
      const entries = await fs.readdir(BACKUP_DIR);
      const out = [];
      for (const name of entries) {
        if (!NAME_RE.test(name)) {
          continue;
        }
        const stat = await fs.stat(path.join(BACKUP_DIR, name));
        out.push({ name, size: stat.size, createdAt: stat.mtime });
      }
      return out.sort((a, b) => (a.name < b.name ? 1 : -1));
    } catch {
      return [];
    }
  }

  public backupPath(name: string): string | null {
    if (!NAME_RE.test(name)) {
      return null;
    }
    return path.join(BACKUP_DIR, name);
  }

  public async run(): Promise<string | null> {
    if (this.running) {
      return null;
    }
    if (process.env.DB_TYPE === 'postgres') {
      logger.warn('Backups job only supports SQLite; use pg_dump for postgres', {
        label: 'Backups',
      });
      return null;
    }
    this.running = true;
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14)
      .replace(/^(\d{8})/, '$1-');
    const name = `backup-${stamp}.zip`;
    const snapshot = path.join(BACKUP_DIR, '.db-snapshot.tmp');
    const target = path.join(BACKUP_DIR, name);

    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      await fs.rm(snapshot, { force: true });

      // consistent point-in-time copy even with WAL active
      await getRepository(MediaMetadata).query(`VACUUM INTO ?`, [snapshot]);

      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(target);
        const archive = new ZipArchive({ zlib: { level: 6 } });
        output.on('close', () => resolve());
        archive.on('error', reject);
        archive.pipe(output);
        archive.file(snapshot, { name: 'db.sqlite3' });
        archive.file(SETTINGS_PATH, { name: 'settings.json' });
        archive.finalize();
      });

      const backups = await this.listBackups();
      for (const old of backups.slice(BACKUP_KEEP)) {
        await fs.rm(path.join(BACKUP_DIR, old.name), { force: true });
      }

      logger.info(`Backup written: ${name}`, { label: 'Backups' });
      return name;
    } catch (e) {
      logger.error(`Backup failed: ${e.message}`, { label: 'Backups' });
      await fs.rm(target, { force: true });
      return null;
    } finally {
      await fs.rm(snapshot, { force: true });
      this.running = false;
    }
  }
}

const backupManager = new BackupManager();

export default backupManager;
