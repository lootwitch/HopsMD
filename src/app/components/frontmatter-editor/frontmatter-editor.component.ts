import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import {
  MarkdownStructureService,
  replaceFrontmatter,
} from '../../services/markdown-structure.service';

interface Entry {
  id: number;
  key: string;
  value: string;
}

let nextEntryId = 1;

/**
 * Editable form for the YAML frontmatter block at the top of a markdown file.
 * Mounted above the rendered article in view mode. Edits an in-memory copy of
 * the entries; "Save" composes the new frontmatter, splices it into the open
 * file, and persists via MarkdownStructureService.saveContent.
 *
 * Scope is deliberately small: flat key/value pairs, string values only.
 * Nested mappings, lists, and block-scalar syntax pass through the source
 * editor untouched — this widget covers the 80% case (title, tags, date).
 */
@Component({
  selector: 'hops-frontmatter-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section class="fm" [class.open]="open()" role="region" aria-label="Frontmatter">
        <header class="fm-head" (click)="toggle()">
          <span class="fm-toggle">{{ open() ? '▾' : '▸' }}</span>
          <span class="fm-title">{{ i18n.t('frontmatter.title') }}</span>
          <span class="fm-count">{{ entries().length }}</span>
          @if (dirty()) { <span class="fm-dirty" [title]="i18n.t('frontmatter.dirty')">•</span> }
        </header>
        @if (open()) {
          <div class="fm-body">
            @for (entry of entries(); track entry.id) {
              <div class="fm-row">
                <input
                  type="text"
                  class="fm-key"
                  [value]="entry.key"
                  (input)="onKeyInput(entry.id, $event)"
                  [placeholder]="i18n.t('frontmatter.keyPlaceholder')"
                  spellcheck="false"
                />
                <input
                  type="text"
                  class="fm-value"
                  [value]="entry.value"
                  (input)="onValueInput(entry.id, $event)"
                  [placeholder]="i18n.t('frontmatter.valuePlaceholder')"
                  spellcheck="false"
                />
                <button
                  type="button"
                  class="fm-del"
                  (click)="removeEntry(entry.id)"
                  [title]="i18n.t('frontmatter.removeField')"
                >
                  ×
                </button>
              </div>
            }
            <div class="fm-actions">
              <button type="button" class="fm-btn" (click)="addEntry()">
                + {{ i18n.t('frontmatter.addField') }}
              </button>
              <span class="fm-spacer"></span>
              @if (dirty()) {
                <button type="button" class="fm-btn" (click)="revert()">
                  {{ i18n.t('frontmatter.revert') }}
                </button>
                <button type="button" class="fm-btn fm-btn-primary" (click)="save()">
                  {{ i18n.t('frontmatter.save') }}
                </button>
              }
            </div>
          </div>
        }
      </section>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .fm {
        margin: 0.6rem 1rem 0.4rem;
        background: var(--hops-stout-2);
        border: 1px solid var(--hops-border);
        border-radius: 6px;
        overflow: hidden;
      }
      .fm-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.7rem;
        cursor: pointer;
        user-select: none;
        font-family: var(--hops-mono);
        font-size: 0.78rem;
        color: var(--hops-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .fm-head:hover { color: var(--hops-foam); }
      .fm-toggle { color: var(--hops-pilsner); }
      .fm-title { flex: 1; }
      .fm-count {
        background: rgba(245, 197, 66, 0.12);
        color: var(--hops-pilsner);
        border-radius: 999px;
        padding: 0 0.5em;
        font-size: 0.72rem;
      }
      .fm-dirty {
        color: var(--hops-pilsner);
        font-size: 1rem;
        line-height: 1;
        font-weight: 700;
      }
      .fm-body {
        padding: 0.5rem 0.7rem 0.7rem;
        border-top: 1px solid var(--hops-border);
      }
      .fm-row {
        display: grid;
        grid-template-columns: minmax(120px, 0.5fr) minmax(0, 1fr) auto;
        gap: 0.4rem;
        margin-bottom: 0.35rem;
      }
      .fm-key, .fm-value {
        background: var(--hops-stout);
        color: var(--hops-text);
        border: 1px solid var(--hops-border);
        border-radius: 4px;
        padding: 0.3rem 0.5rem;
        font-family: var(--hops-mono);
        font-size: 0.82rem;
        outline: none;
        min-width: 0;
      }
      .fm-key:focus, .fm-value:focus {
        border-color: rgba(245, 197, 66, 0.55);
      }
      .fm-del {
        appearance: none;
        background: transparent;
        border: 1px solid var(--hops-border);
        color: var(--hops-text-dim);
        border-radius: 4px;
        padding: 0 0.5rem;
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
      }
      .fm-del:hover {
        color: var(--hops-cherry);
        border-color: rgba(179, 64, 54, 0.4);
      }
      .fm-actions {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 0.4rem;
      }
      .fm-spacer { flex: 1; }
      .fm-btn {
        appearance: none;
        background: rgba(255, 255, 255, 0.04);
        color: var(--hops-text-dim);
        border: 1px solid var(--hops-border);
        border-radius: 4px;
        padding: 0.25rem 0.65rem;
        font-family: var(--hops-mono);
        font-size: 0.78rem;
        cursor: pointer;
      }
      .fm-btn:hover {
        background: rgba(245, 197, 66, 0.1);
        color: var(--hops-foam);
        border-color: rgba(245, 197, 66, 0.35);
      }
      .fm-btn-primary {
        background: rgba(245, 197, 66, 0.15);
        border-color: rgba(245, 197, 66, 0.4);
        color: var(--hops-pilsner);
        font-weight: 500;
      }
      .fm-btn-primary:hover {
        background: rgba(245, 197, 66, 0.25);
        color: var(--hops-foam);
      }
    `,
  ],
})
export class FrontmatterEditorComponent {
  protected readonly state = inject(MarkdownStructureService);
  protected readonly i18n = inject(I18nService);

  /** Full markdown source — frontmatter is parsed out, rest is left alone. */
  readonly content = input<string>('');

  protected readonly open = signal<boolean>(false);
  /** Local working copy. Reset to the parsed source via the `content` input
   *  whenever the user has nothing dirty in flight. */
  protected readonly entries = signal<readonly Entry[]>([]);

  /** YAML re-emitted from the current `entries` — what would be saved. */
  private readonly composed = computed(() => serializeEntries(this.entries()));

  /** The parsed-from-source state, derived directly from the input. */
  private readonly parsedFromSource = computed(() => parseFrontmatter(this.content()));

  protected readonly visible = computed(() => {
    const parsed = this.parsedFromSource();
    return parsed.hasFrontmatter || this.entries().length > 0 || this.open();
  });

  protected readonly dirty = computed(() => {
    const source = this.parsedFromSource().raw;
    return this.composed() !== source;
  });

  private lastSyncedContent = '';

  /** Keep `entries` in sync with the source whenever the file changes —
   *  but leave the user's working copy alone if they have unsaved local
   *  edits for the same content version. */
  private readonly syncEffect = effect(() => {
    const incoming = this.content();
    if (incoming === this.lastSyncedContent) return;
    if (!this.dirty() || this.entries().length === 0) {
      this.entries.set(this.parsedFromSource().entries);
    }
    this.lastSyncedContent = incoming;
  });

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected onKeyInput(id: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.entries.update((arr) =>
      arr.map((e) => (e.id === id ? { ...e, key: value } : e)),
    );
  }

  protected onValueInput(id: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.entries.update((arr) =>
      arr.map((e) => (e.id === id ? { ...e, value } : e)),
    );
  }

  protected addEntry(): void {
    this.entries.update((arr) => [
      ...arr,
      { id: nextEntryId++, key: '', value: '' },
    ]);
    this.open.set(true);
  }

  protected removeEntry(id: number): void {
    this.entries.update((arr) => arr.filter((e) => e.id !== id));
  }

  protected revert(): void {
    this.entries.set(this.parsedFromSource().entries);
  }

  protected async save(): Promise<void> {
    const fm = this.composed();
    const updated = replaceFrontmatter(this.content(), fm);
    await this.state.saveContent(updated);
  }
}

/** Parse a flat YAML frontmatter block. Ignores comments and structural
 *  YAML; values are taken as plain strings (quotes stripped if balanced). */
export function parseFrontmatter(source: string): {
  entries: Entry[];
  raw: string;
  hasFrontmatter: boolean;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { entries: [], raw: '', hasFrontmatter: false };
  const yaml = match[1];
  const entries: Entry[] = [];
  for (const line of yaml.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ id: nextEntryId++, key, value });
  }
  return { entries, raw: yaml, hasFrontmatter: true };
}

/** Decide whether a plain-string YAML value needs explicit quoting. Conservative
 *  — only quote when YAML would otherwise misparse the value. Commas, periods,
 *  apostrophes, and other "normal" punctuation pass through unquoted. */
function needsYamlQuotes(value: string): boolean {
  if (value === '') return true;
  if (/^\s|\s$/.test(value)) return true; // leading/trailing whitespace
  // Special leading chars that introduce YAML constructs.
  if (/^[-?*&!|>%@`:#\[\{"']/.test(value)) return true;
  if (value.includes(': ')) return true; // would look like a nested mapping
  return false;
}

function serializeEntries(entries: readonly Entry[]): string {
  const lines: string[] = [];
  for (const e of entries) {
    if (!e.key.trim()) continue;
    const key = e.key.trim();
    let value = e.value;
    if (needsYamlQuotes(value)) {
      value = `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    lines.push(`${key}: ${value}`);
  }
  return lines.join('\n');
}
