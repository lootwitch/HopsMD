---
title: Frontmatter — Form-Editor
author: HopsMD QA
date: 2026-06-29
tags: meta, frontmatter, yaml
status: draft
priority: 5
---

# ⑲ Frontmatter-Editor

Diese Datei hat einen Frontmatter-Block (oben zwischen `---` Zeilen).
Über dem gerenderten Artikel erscheint deshalb ein einklappbares
**Metadaten**-Panel mit jedem Schlüssel als Formularfeld.

## Checkliste

### Anzeige
- [ ] Im Filebar-Bereich erscheint der "Metadaten"-Block
- [ ] Beim Klick auf den Header klappt er auf und zeigt 6 Reihen:
      `title`, `author`, `date`, `tags`, `status`, `priority`
- [ ] Die Werte sind die aus dem Frontmatter, **ohne** Anführungszeichen
- [ ] Beim ersten Anzeigen erscheint **kein** Dirty-Indikator (`•`)

### Bearbeiten
- [ ] In ein Wert-Feld klicken und Wert ändern → Dirty-Indikator `•` taucht auf
- [ ] "Verwerfen" → zurück auf die geparsten Original-Werte
- [ ] Wert ändern + "Metadaten speichern" → Datei auf der Platte ist aktualisiert
- [ ] Nach Save: Dirty-Indikator verschwindet

### Felder verwalten
- [ ] "+ Feld hinzufügen" → neue leere Reihe am Ende
- [ ] Key + Value eintragen + speichern → erscheint im Frontmatter
- [ ] **×** an einer Reihe → Feld entfernen + speichern → ist aus der Datei weg

### Edge Cases
- [ ] Wert mit Komma ("a, b, c") → wird unquoted geschrieben (Whitespace-freundlich)
- [ ] Wert mit Doppelpunkt+Space ("foo: bar") → wird mit Quotes gespeichert
- [ ] Leerer Wert → wird mit `""` gespeichert
- [ ] Datei ohne Frontmatter → Panel nicht sichtbar, "+ Feld" legt einen neuen Block an
