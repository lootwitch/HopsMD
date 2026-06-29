---
title: Editor — Suchen & Ersetzen
tags: [editor, codemirror, search]
feature: search-replace
---

# ⑬ Suchen & Ersetzen im Editor

Das CodeMirror-Such-Panel ist jetzt verdrahtet. Datei mit **Ctrl+E** in den
Editor-Modus bringen, dann die Shortcuts ausprobieren.

## Test-Inhalt mit Wiederholungen

Im Wort *hopfen* steckt die Würze: Hopfen verleiht Bier sein Aroma.
Auch HOPFEN in Großbuchstaben ist Hopfen, technisch gesehen.
Mehr Hopfen, mehr Bitterstoffe, mehr Charakter.

`hopfen()` ist eine fiktive Funktion. Sie verarbeitet hopfen-Variablen wie
`hopfenMenge` und `hopfenSorte` — solche Bezeichner ignoriert die Suche,
außer du aktivierst Whole-Word.

Noch mehr Hopfen, damit Replace-All etwas zu tun hat:
- erster Hopfen
- zweiter Hopfen
- dritter Hopfen

## Checkliste

### Find (Ctrl+F)
- [ ] **Ctrl+F** im Editor → Such-Panel öffnet sich am oberen Editor-Rand
- [ ] Panel ist im Brewpub-Theme (kein weißer Kasten auf dunkel)
- [ ] Tippe "hopfen" → alle Treffer werden hervorgehoben
- [ ] Enter / "next" → springt zum nächsten Treffer
- [ ] "previous" → springt zum vorigen
- [ ] **match case** toggeln → `HOPFEN`-Treffer verschwinden / kommen wieder
- [ ] **regexp** toggeln + `hop\w+` eingeben → `hopfen`, `hopfenMenge`, `hopfenSorte` alle markiert
- [ ] **by word** (whole word) toggeln → nur freistehende `hopfen` matchen, nicht `hopfen()` als Funktionsname
- [ ] **Escape** → Panel schließt

### Replace (Ctrl+H)
- [ ] **Ctrl+H** → Panel öffnet sich inkl. Replace-Zeile
- [ ] "hopfen" → "malz" eintragen
- [ ] **replace** → ersetzt nur den aktuellen Treffer
- [ ] **replace all** → ersetzt alle übrigen
- [ ] Undo (**Ctrl+Z**) → macht den Bulk-Replace rückgängig
