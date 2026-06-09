---
title: HopsMD Test-Suite — Start hier
tags: [test, smoke-test, hopsmd]
author: HopsMD
---

# 🍺 HopsMD Test-Suite — Start hier

Öffne **diesen Ordner** (`samples/test-suite/`) in HopsMD als Brewhouse und
klicke dich durch. Jede Seite deckt einen Funktionsbereich ab — die Wiki-Links
unten öffnen sie direkt im Viewer.

> [!TIP]
> Diese Datei ist auch ein guter Kandidat zum Anpinnen als **Stammsudhaus**
> (Favorit) — teste damit gleich die Favoriten-Leiste.

---

## 📄 Render-Tests (einfach anklicken)

Diese Seiten testen das reine Rendering. Durchklicken und visuell prüfen:

1. [[01-Text-Formatting|① Textformatierung]] — Überschriften, Betonung, Listen, Zitate, Trennlinien, Inline-Code
2. [[02-Code-Highlighting|② Syntax-Highlighting]] — viele Sprachen + Code-Toolbar (Kopieren / im Editor öffnen)
3. [[03-Tables-and-Tasks|③ Tabellen & Aufgabenlisten]] — GFM-Tabellen mit Ausrichtung, Checkboxen
4. [[04-Math-KaTeX|④ Mathe (KaTeX)]] — inline `$…$` und Block `$$…$$`
5. [[05-Admonitions|⑤ Hinweisboxen]] — NOTE / TIP / IMPORTANT / WARNING / CAUTION
6. [[06-Emoji-and-Footnotes|⑥ Emoji & Fußnoten]] — `:shortcode:` und `[^1]`
7. [[07-Definition-Lists|⑦ Definitionslisten]] — `Begriff` / `: Definition`
8. [[08-Wiki-Links|⑧ Wiki-Links]] — Querverweise zwischen Dateien
9. [[09-Mermaid-Gallery|⑨ Mermaid-Galerie]] — 7 Diagrammtypen + Vollbild + Quelltext-Umschalter
10. [[10-Images-and-Assets|⑩ Bilder & Assets]] — relative Bilder + Wiki-Embed
11. [[11-Edge-Cases|⑪ Grenzfälle]] — kaputtes Mermaid (Fehlerisolierung), Frontmatter, leere Blöcke

Und der Ordnerbaum tiefer:

- [[Nested/Sub-Recipe|↳ Unter-Rezept (Ebene 1)]]
- [[Nested/Level-2/Deep-Note|↳ Tiefe Notiz (Ebene 2)]]

---

## 🖱️ Interaktive Features — manuelle Checkliste

Diese kann man nicht in einer Datei „rendern" — bitte aktiv durchprobieren:

### Bearbeiten / Speichern (Phase 2)
- [ ] **Ctrl+E** oder Doppelklick auf den Artikel → wechselt in den CodeMirror-Editor
- [ ] Tippen → der `•` Dirty-Marker erscheint im Filebar
- [ ] **Ctrl+S** → speichert, kehrt zur Ansicht zurück, `•` verschwindet
- [ ] **Esc** bei ungespeicherten Änderungen → Verwerfen-Abfrage
- [ ] Beim Speichern entsteht **kein** Reload-Loop (Echo-Cancel funktioniert)

### Dateioperationen im Baum (Phase 2)
- [ ] Rechtsklick auf einen Knoten → *Neue Datei*, *Neuer Ordner*, *Umbenennen*, *Löschen*
- [ ] Inline-Umbenennen mit Enter bestätigen / Escape abbrechen
- [ ] Ungültiger Name (`..`, leer, mit `/` oder `\`) → saubere Fehlermeldung, kein Crash
- [ ] Neue `.md` ohne Endung anlegen → `.md` wird automatisch ergänzt

### Watcher (Live-Aktualisierung)
- [ ] Diese Datei **außerhalb** von HopsMD im Editor ändern & speichern → Ansicht aktualisiert sich
- [ ] Datei/Ordner extern anlegen oder löschen → der Baum aktualisiert sich automatisch

### Konflikt-Erkennung
- [ ] In HopsMD in den Edit-Modus gehen, **gleichzeitig** die Datei extern ändern →
  Konflikt-Banner mit *Neu laden* / *Meine Änderungen behalten*

### Einstellungen & Theming
- [ ] Einstellungen öffnen → Farben anpassen → Ansicht übernimmt sie live
- [ ] App neu starten → Theming bleibt erhalten (localStorage)
- [ ] Bei ungespeicherten Änderungen Richtung Einstellungen navigieren → Verwerfen-Abfrage

### Sonstiges
- [ ] Sprache DE ↔ EN umschalten
- [ ] Schrift / Zoom ändern und Persistenz nach Neustart prüfen
- [ ] Inhaltsverzeichnis (TOC) springt zu Überschriften
- [ ] Fenster mit ungespeicherten Änderungen schließen → Close wird blockiert

---

Viel Spaß beim Testen! :beer: Zurück zum Anfang führt jeder `[[00-START-HERE]]`-Link.
