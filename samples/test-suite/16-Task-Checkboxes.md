---
title: Klickbare Task-Checkboxen
tags: [viewer, tasks, gfm]
feature: task-checkboxes
---

# ⑯ Klickbare GFM Task-Checkboxen

GFM `- [ ]` / `- [x]` Listen sind im **Ansichtsmodus** jetzt interaktiv —
ein Klick auf die Checkbox toggelt sie in der Datei.

## Brauplan

- [ ] Wasser anwärmen auf 65°C
- [x] Malz schroten
- [ ] Maische einmaischen
- [ ] Läutern und Würze abziehen
- [x] Hopfen abwiegen
- [ ] Würze kochen
- [ ] Whirlpool & abkühlen
- [ ] In den Gärtank überführen
- [x] Hefe zugeben
- [ ] Gärung beobachten

## Verschachtelt

- [ ] Außen
  - [ ] Innen 1
  - [x] Innen 2

## Mit Indentation

  - [ ] Eingerückt 1
  - [ ] Eingerückt 2

## Checkliste

- [ ] In der Ansicht (nicht im Editor!) auf eine `[ ]`-Box klicken → wird zu `[x]`
- [ ] Auf eine `[x]`-Box klicken → wird zu `[ ]`
- [ ] Die Datei im OS-Editor öffnen → der Source ist tatsächlich umgeschrieben
- [ ] Verschachtelte und eingerückte Listen funktionieren auch
- [ ] Im Edit-Modus (**Ctrl+E**) Klick auf Checkbox → ändert den Edit-Buffer
      (statt direkt zu speichern)
- [ ] Watcher kommt nicht in Echo-Loop nach dem Toggle
