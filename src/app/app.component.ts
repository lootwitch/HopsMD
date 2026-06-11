import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TreeDragService } from './services/tree-drag.service';

@Component({
  selector: 'hops-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  private readonly treeDrag = inject(TreeDragService);

  constructor() {
    // With `dragDropEnabled: false` (needed for the tree's HTML5 DnD on
    // WebView2) the webview handles drags itself — an unhandled OS file drop
    // would NAVIGATE the window to the file:// URL and kill the SPA. Claim
    // every drag that isn't an internal tree drag and swallow its drop.
    // Internal tree drags stay untouched inside the tree (rows decide), but
    // are blocked elsewhere so e.g. CodeMirror doesn't paste the path text.
    const inTree = (e: DragEvent): boolean =>
      e.target instanceof Element && !!e.target.closest('hops-file-tree');
    const onDragOver = (e: DragEvent): void => {
      if (this.treeDrag.dragged() !== null) {
        // Outside the tree: stop CodeMirror & co. from accepting the drag.
        if (!inTree(e)) e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };
    const onDrop = (e: DragEvent): void => {
      if (this.treeDrag.dragged() !== null && inTree(e)) return; // rows handle it
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('drop', onDrop, true);
    });
  }
}
