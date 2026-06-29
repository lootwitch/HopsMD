---
title: Bild per Paste / Drop
tags: [editor, images, assets]
feature: image-paste
---

# ⑮ Bild per Paste / Drop einfügen

Im Editor lassen sich Bilder direkt aus der Zwischenablage einfügen oder
per Drag & Drop hineinziehen. HopsMD legt sie in einen `assets/`-Ordner
neben dieser Datei und fügt einen relativen Markdown-Link am Cursor ein.

## Test-Setup

1. Mit **Ctrl+E** in den Editor wechseln.
2. Cursor in die Zeile unter "Hier einfügen:" setzen.

Hier einfügen:

---

## Checkliste

### Paste
- [ ] Einen Screenshot ins Clipboard kopieren (z. B. **Win+Shift+S**)
- [ ] Im Editor **Ctrl+V** → ein `assets/pasted-…png` wird angelegt und ein
      `![pasted-…](assets/pasted-…png)` eingefügt
- [ ] Speichern (**Ctrl+S**) → Ansicht zeigt das Bild gerendert
- [ ] Beim erneuten Pasten desselben Bildes: Dateiname bekommt `-2`, `-3`, … Suffix

### Drag & Drop
- [ ] Eine `.png`/`.jpg` aus dem Explorer auf den Editor ziehen → wird unter
      `assets/<originalname>` abgelegt, Link am Cursor eingefügt
- [ ] Mehrere Bilder gleichzeitig droppen → alle landen drin
- [ ] **Nicht-Bild** droppen (z. B. eine `.txt`) → Editor blockt das Native-Drop,
      es passiert nichts (kein Webview-Reload)

### Ergebnis
- [ ] Im Explorer existiert jetzt `samples/test-suite/assets/` mit den Bildern
- [ ] Die Bilder erscheinen im Recipe-Tree (sind ja `.png` etc.)
