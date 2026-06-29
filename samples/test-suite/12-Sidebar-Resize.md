---
title: Sidebar Resize — manueller Test
tags: [ui, sidebar, drag-drop]
feature: sidebar-resize
---

# ⑫ Sidebar resizable per Drag

Die Trennlinie zwischen Rezeptbuch-Sidebar und Inhalt kann jetzt mit der Maus
verbreitert/verschmälert werden. Beim Hover am rechten Sidebar-Rand wird der
Cursor zum `col-resize`-Cursor und ein Amber-Streifen leuchtet auf.

## Checkliste

- [ ] Mauszeiger an den rechten Rand der Sidebar → Cursor wird zum `↔`-Cursor
- [ ] Ziehen nach rechts → Sidebar wird breiter, Hauptbereich schmaler
- [ ] Ziehen nach links → wird schmaler, **clamped bei 180px** (geht nicht kleiner)
- [ ] Weit nach rechts ziehen → **clamped bei 600px** (geht nicht breiter)
- [ ] **Doppelklick** auf den Drag-Handle → Reset auf 280px Default
- [ ] App neu starten → die zuletzt eingestellte Breite ist wieder da
- [ ] Während Drag: Text-Selektion ist überall global unterdrückt

## Hintergrund

Persistiert in `localStorage` unter `hopsmd.sidebarWidth`. Implementiert via
Pointer-Events in `viewer-shell.component.ts`.
