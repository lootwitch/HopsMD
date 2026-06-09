# ⑫ Multi-Format-Viewer

Zurück zum [[../00-START-HERE|Start]].

Diese Seite bündelt die Nicht-Markdown-Formate. Klick jede Datei an (Links hier
oder direkt im Dateibaum) und prüfe das erwartete Verhalten.

> [!NOTE]
> Markdown & diese Formate teilen sich denselben Dateibaum. Text ist
> **bearbeitbar** (wie `.md`), E-Mail und Bild sind **read-only** (kein ✎-Button).

---

## 📝 Klartext (bearbeitbar)

- [[sample.txt|sample.txt]] — Klartext; `**Sterne**` und `#` müssen **wörtlich**
  stehen bleiben (kein Markdown). ✎ / **Ctrl+E** öffnet CodeMirror, **Ctrl+S** speichert.
- [[brew-day.log|brew-day.log]] — `.log` wird ebenfalls als Klartext erkannt; die
  letzte `#`-Zeile darf **nicht** zur Überschrift werden.

**Prüfen:** Monospace-Darstellung · ✎-Button vorhanden · Bearbeiten & Speichern · `•` Dirty-Marker.

---

## ✉️ E-Mail (read-only)

- [[sample.eml|sample.eml]] — HTML-Body. Das eingebettete externe Bild
  (`example.com/pixel.png`) darf **nicht** laden (CSP blockt Remote-Inhalte).
- [[plain-only.eml|plain-only.eml]] — nur Text-Body → `<pre>`-Fallback, Umlaute korrekt.
- [[with-attachment.eml|with-attachment.eml]] — zeigt oben den Anhang-Namen
  `rezept-notiz.txt` (nicht anklickbar).

**Prüfen:** Header-Karte (Von/An/Betreff/Datum) · HTML- bzw. Text-Body · Anhang-Liste ·
**kein** ✎-Button · ein Link im HTML-Body öffnet **extern** (navigiert die App nicht weg).

---

## 🖼️ Bilder (read-only)

- [[icon-128.png|icon-128.png]] — Raster, 128×128 → Maße-Caption unten.
- [[icon-32.png|icon-32.png]] — kleines Raster, 32×32.
- [[hops-logo.svg|hops-logo.svg]] — Vektor (SVG).

Eingebettete Vorschau (Wiki-Embed, relativ aufgelöst):

![[icon-128.png]]

**Prüfen:** zentriert auf Karo-Hintergrund · Dateiname + Maße in der Caption · **kein** ✎-Button.

---

## ℹ️ `.msg` (Outlook)

`.msg` ist ein binäres OLE-Format und lässt sich nicht sinnvoll als Textdatei in
dieses Repo legen. Zum Testen eine echte `.msg` aus Outlook in diesen Ordner
kopieren — sie sollte wie eine E-Mail (Header + Body + Anhang-Namen) erscheinen.
