---
title: Auto-Save + Dirty-Indicator
tags: [editor, autosave]
feature: autosave
---

# ㉑ Auto-Save & Dirty-Indikator

Optional. Standardmäßig aus, lässt sich unter **Einstellungen → Editor →
Automatisches Speichern** aktivieren, inkl. Debounce-Slider (300 ms – 10 s).

## Vorbereitung

1. Diese Datei mit **Ctrl+E** öffnen.
2. Settings → Editor → "Änderungen beim Tippen automatisch speichern" → An.
3. Debounce auf z. B. 1 s setzen.

## Sandbox-Text

Hier reinschreiben und tippen, dann beobachten was im Filebar passiert:

(deine Notizen hier)

## Checkliste

### Dirty-Indikator
- [ ] Bei jedem Tipp: der `•`-Punkt im Filebar **pulsiert** (Opacity 1 ↔ 0.45)
- [ ] Speichern → `•` verschwindet

### Auto-Save (Editing-Modus bleibt)
- [ ] Auto-Save an. Im Editor tippen.
- [ ] Filebar zeigt rechts "auto-save bereit…" (Tooltip: Pause + ms)
- [ ] Aufhören zu tippen → nach Debounce-Zeit ändert sich der Text zu
      "gespeichert um HH:MM" in grün
- [ ] **Du bleibst im Edit-Modus** (kein Eject)
- [ ] Erneut tippen → Status wechselt wieder zu "auto-save bereit…"

### Explizites Save bleibt anders
- [ ] **Ctrl+S** → speichert UND geht zurück zur Ansicht
      (anders als Auto-Save, das im Edit-Modus bleibt)

### Persistenz
- [ ] Auto-Save-Setting überlebt App-Neustart (localStorage)
- [ ] Debounce-Wert ebenfalls

### Edge Cases
- [ ] Auto-Save aus → Status-Text verschwindet aus dem Filebar
- [ ] Im Ansichts-Modus (nicht editing) → kein Auto-Save-Status
