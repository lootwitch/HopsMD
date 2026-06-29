---
title: Editor — Markdown-Tastenkürzel
tags: [editor, codemirror, shortcuts]
feature: markdown-shortcuts
---

# ⑭ Markdown-Tastenkürzel

Im Editor (**Ctrl+E**) sind jetzt drei häufige Marker-Shortcuts plus
Listen-Fortsetzung verdrahtet.

## Test-Sandbox

Wähle Wörter in dieser Zeile aus und probiere die Shortcuts: probier dies aus und das auch.

Hier ist eine Liste — Cursor ans Ende einer Zeile und Enter drücken:
- erstes Bier
- zweites Bier
- (hier weitermachen)

Nummerierte Liste:
1. Erst maischen
2. Dann läutern
3. (hier Enter drücken)

## Checkliste

### Bold (Ctrl+B)
- [ ] Wort markieren → **Ctrl+B** → wird zu `**Wort**`
- [ ] Erneut **Ctrl+B** auf demselben Wort → Marker werden entfernt (Toggle)
- [ ] Ohne Selektion: **Ctrl+B** → Cursor steht zwischen `****`

### Italic (Ctrl+I)
- [ ] Wort markieren → **Ctrl+I** → `*Wort*`
- [ ] Toggle funktioniert wie bei Bold

### Link (Ctrl+K)
- [ ] Wort markieren → **Ctrl+K** → wird zu `[Wort](url)`
- [ ] Der Platzhalter `url` ist **vorselektiert** — sofort tippen ersetzt ihn
- [ ] Ohne Selektion: `[text](url)` mit `url` selektiert

### Listen-Fortsetzung
- [ ] Cursor ans Ende von `erstes Bier` → Enter → neue Zeile mit `- ` Präfix
- [ ] Auch bei `1. Erst maischen` → Enter → `2. ` (Auto-Increment)
- [ ] Auf leerer Listen-Zeile Enter → Liste wird beendet
