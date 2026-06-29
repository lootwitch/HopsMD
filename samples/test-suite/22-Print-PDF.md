---
title: Print / Save-as-PDF
tags: [print, pdf, export]
feature: print
---

# ㉒ Print & Save-as-PDF

**Ctrl+P** (oder das ⎙-Symbol im Filebar) öffnet den Browser/OS-Print-Dialog
mit einem aufgeräumten Print-Stylesheet: nur der gerenderte Artikel, ohne
Toolbar/Sidebar/TOC/Banner.

## Demo-Inhalt für die Print-Vorschau

Diese Seite enthält absichtlich verschiedene Elemente, damit du in der Print-
Vorschau prüfen kannst, wie sie auf Papier wirken.

### Überschrift mit Text danach

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Hier ist auch ein
[Link zur Übersicht](00-START-HERE.md) — Links sollen schwarz und unterstrichen
erscheinen, nicht in der Brewpub-Amber-Farbe.

### Code-Block

```python
def brewing(grain, hop, water):
    """Klassisches Bierrezept."""
    mash = einmaischen(grain, water)
    wort = laeutern(mash)
    return kochen(wort, hop)
```

### Tabelle

| Zutat   | Menge   | Quelle    |
|---------|---------|-----------|
| Pilsner | 5 kg    | Weyermann |
| Cara    | 0.3 kg  | Weyermann |
| Saaz    | 30 g    | Hallertau |

### Liste

1. Wasser auf 65°C
2. Malz einmaischen
3. 60 min Maltose-Rast
4. Abmaischen bei 78°C

## Checkliste

### Auslösen
- [ ] **Ctrl+P** in der Ansicht → Print-Dialog öffnet sich
- [ ] Alternativ: ⎙-Knopf im Filebar (nur sichtbar bei Markdown-Files in View-Mode)
- [ ] **Ctrl+P** im Edit-Modus → **nichts** passiert (Shortcut ist View-only)

### Print-Preview-Inhalt
- [x] **Keine Toolbar** (kein Logo, kein Sudhaus-Picker)
- [x] **Keine Sidebar** (kein Rezeptbuch, kein Sudhaus)
- [x] **Keine TOC** rechts
- [ ] **Kein Filebar** (kein Pfad, keine Buttons)
- [ ] **Kein Metadaten-Panel**
- [ ] **Kein Find-in-Files**-Overlay
- [ ] **Code-Block-Toolbars** sind unsichtbar
- [x] Schwarzer Text auf weißem Hintergrund
- [x] Code-Blöcke: schwarzer Text, grauer Background, mit Border
- [x] Links: schwarz + unterstrichen
- [ ] Überschriften bleiben mit ihrer ersten Content-Zeile zusammen (kein Page-Break direkt darunter)

### Export
- [ ] Im Print-Dialog "Als PDF speichern" → erzeugt eine saubere PDF
- [ ] Auf echtem Drucker testen (optional, wenn Hardware verfügbar)
