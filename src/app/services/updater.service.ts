import { Injectable, signal } from '@angular/core';
import { isTauri } from '../core/tauri-bridge';

/**
 * In-app updater driven by `tauri-plugin-updater`. Every call goes through
 * try/catch because the plugin is feature-gated on the Rust side — when the
 * `updater` Cargo feature is off (default during MVP) the JS imports
 * resolve but the underlying Tauri command is missing, which is fine: we
 * just stay quiet and let `winget upgrade` carry the update path.
 *
 * Activation checklist lives in docs/RELEASE.md.
 */
@Injectable({ providedIn: 'root' })
export class UpdaterService {
  readonly availableVersion = signal<string | null>(null);
  readonly availableNotes = signal<string | null>(null);
  readonly installing = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (isTauri()) {
      void this.checkSilently();
    }
  }

  private async checkSilently(): Promise<void> {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        this.availableVersion.set(update.version);
        this.availableNotes.set(update.body ?? null);
      }
    } catch (err) {
      // Updater plugin not present (feature off) or any other failure —
      // intentionally silent. We log at debug so devs can spot it if they're
      // looking for it but users never see it.
      // eslint-disable-next-line no-console
      console.debug('[HopsMD/updater] check skipped:', err);
    }
  }

  /** User clicked "Jetzt installieren". Downloads, installs, relaunches. */
  async install(): Promise<void> {
    if (this.installing()) return;
    this.installing.set(true);
    this.error.set(null);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update?.available) {
        this.availableVersion.set(null);
        return;
      }
      await update.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.installing.set(false);
    }
  }

  dismiss(): void {
    this.availableVersion.set(null);
    this.availableNotes.set(null);
    this.error.set(null);
  }
}
