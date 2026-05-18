import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BreweryToolbarComponent } from './components/brewery-toolbar/brewery-toolbar.component';
import { FavoritesPanelComponent } from './components/favorites-panel/favorites-panel.component';
import { FileTreeComponent } from './components/file-tree/file-tree.component';
import { MarkdownViewComponent } from './components/markdown-view/markdown-view.component';
import { MarkdownStructureService } from './services/markdown-structure.service';

@Component({
  selector: 'hops-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreweryToolbarComponent,
    FavoritesPanelComponent,
    FileTreeComponent,
    MarkdownViewComponent,
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
      </aside>

      <section class="content">
        <hops-markdown-view />
      </section>
    </main>
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
      .content {
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class AppComponent {
  protected readonly state = inject(MarkdownStructureService);
}
