---
title: Spellcheck-Toggle
tags: [editor, spellcheck]
feature: spellcheck
---

# ⑳ Spellcheck im Editor

Optionale Browser-/OS-Rechtschreibprüfung. Standardmäßig aus, lässt sich
unter **Einstellungen → Editor → Rechtschreibprüfung** aktivieren.

## Test-Text mit absichtlichen Fehlern

Hier sind ein paar gezielte Tipfeler in einem ansonten normalen Satz: heute
gehe ich ins Sudhauz und braue ein neuse Pils. Der Hopfen ist frich, das Malz
ist getrocknat, das Wasser ist reien.

Auch einzelne fragliche Wörter: heloo, wurld, typoss, brwning.

(Code-Wörter wie `fooBar` sollten **nicht** unterkringelt sein — Browser
spellcheck überspringt CamelCase / Code-ähnliche Tokens meistens.)

## Checkliste

- [ ] Diese Datei mit **Ctrl+E** öffnen — initial **keine** roten Kringel
- [ ] **Einstellungen** (Zahnrad) → Editor → "Tippfehler im Editor markieren"
      auf An
- [ ] Zurück (Esc) zur Datei — die Tippfehler sind jetzt rot unterkringelt
- [ ] Rechtsklick auf einen unterkringelten Tipfeler → Browser-Korrektur-Menü
- [ ] Setting wieder aus → Kringel verschwinden ohne Editor-Neuaufbau
- [ ] App neu starten → Setting ist persistent (in `localStorage`)
- [ ] Die Wörterbücher kommen vom Betriebssystem — Deutsch funktioniert nur,
      wenn der OS-Spellchecker DE installiert hat
