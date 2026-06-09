// src/app/components/viewer-shell/viewer-shell.component.ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { BreweryToolbarComponent } from '../brewery-toolbar/brewery-toolbar.component';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { FavoritesPanelComponent } from '../favorites-panel/favorites-panel.component';
import { FileTreeComponent } from '../file-tree/file-tree.component';
import { MarkdownViewComponent } from '../markdown-view/markdown-view.component';
import { MermaidFullscreenComponent } from '../mermaid-fullscreen/mermaid-fullscreen.component';
import { MarkdownStructureService } from '../../services/markdown-structure.service';
import { I18nService } from '../../services/i18n.service';
import { appVersionBridge, isTauri } from '../../core/tauri-bridge';

@Component({
  selector: 'hops-viewer-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreweryToolbarComponent,
    ContextMenuComponent,
    FavoritesPanelComponent,
    FileTreeComponent,
    MarkdownViewComponent,
    MermaidFullscreenComponent,
  ],
  template: `
    <hops-brewery-toolbar />

    <main class="layout">
      <aside class="sidebar" aria-label="Sudhause und Rezeptbuch">
        <hops-favorites-panel />

        <div class="sidebar-header">
          <span>🍻</span>
          <span>Rezeptbuch</span>
        </div>

        <div class="sidebar-body">
          @if (state.tree(); as root) {
            <hops-file-tree [node]="root" [depth]="0" />
          } @else {
            <div class="sidebar-empty">
              Noch kein Sudhaus offen. Wähle oben einen Ordner aus, um die Karte zu zapfen.
            </div>
          }
        </div>

        <div class="sidebar-version" title="HopsMD">v{{ version() }}</div>
      </aside>

      <section class="content">
        <hops-markdown-view />
      </section>
    </main>

    <hops-context-menu />
    <hops-mermaid-fullscreen />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(220px, 320px) 1fr;
        flex: 1;
        min-height: 0;
      }
      .sidebar {
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--hops-stout-2);
        border-right: 1px solid var(--hops-border);
      }
      .sidebar-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.85rem;
        border-bottom: 1px solid var(--hops-border);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--hops-text-dim);
      }
      .sidebar-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0.35rem 0.25rem 1rem;
      }
      .sidebar-empty {
        padding: 1rem 1rem 0;
        font-size: 0.82rem;
        color: var(--hops-text-dim);
        font-style: italic;
      }
      .sidebar-version {
        flex-shrink: 0;
        padding: 0.3rem 0.85rem;
        border-top: 1px solid var(--hops-border);
        font-family: var(--hops-mono);
        font-size: 0.68rem;
        letter-spacing: 0.3px;
        color: var(--hops-text-dim);
        opacity: 0.7;
        user-select: text;
      }
      .content {
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class ViewerShellComponent {
  protected readonly state = inject(MarkdownStructureService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** App version shown small at the bottom of the sidebar. */
  protected readonly version = signal<string>('');

  constructor() {
    void appVersionBridge()
      .then((v) => this.version.set(v))
      .catch(() => this.version.set('dev'));

    if (isTauri()) {
      void (async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        // Tauri's onCloseRequested wrapper destroys the window after the handler
        // resolves *unless* preventDefault() was called. We only ever want to
        // block the close while there are unsaved edits — and then only if the
        // user declines the discard prompt. preventDefault() is called up front
        // so the async confirm can't race the wrapper's auto-destroy.
        const unlisten = await win.onCloseRequested((event) => {
          if (!this.state.dirty()) return; // clean → wrapper auto-destroys it
          const leave = confirm(this.i18n.t('edit.discardConfirm'));
          if (!leave) {
            event.preventDefault();
            return;
          }
          // Not prevented → the wrapper destroys the window for us; just clear
          // the edit state so no stale dirty guard lingers.
          this.state.cancelEditing();
        });
        this.destroyRef.onDestroy(() => unlisten());
      })();
    }
  }
}
