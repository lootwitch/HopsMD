# ⑫ Multi-Format-Viewer

Zurück zum [[../00-START-HERE|Start]].

Diese Seite bündelt die Nicht-Markdown-Formate. Klick jede Datei an (Links hier
oder direkt im Dateibaum) und prüfe das erwartete Verhalten.

> [!NOTE]
> Markdown & diese Formate teilen sich denselben Dateibaum. Text, JSON und
> HTTP sind **bearbeitbar** (wie `.md`); E-Mail, Bild und PDF sind
> **read-only** (kein ✎-Button).

---

## 📝 Klartext (bearbeitbar)

- [[sample.txt|sample.txt]] — Klartext; `**Sterne**` und `#` müssen **wörtlich**
  stehen bleiben (kein Markdown). ✎ / **Ctrl+E** öffnet CodeMirror, **Ctrl+S** speichert.
- [[brew-day.log|brew-day.log]] — `.log` wird ebenfalls als Klartext erkannt; die
  letzte `#`-Zeile darf **nicht** zur Überschrift werden.

**Prüfen:** Monospace-Darstellung · ✎-Button vorhanden · Bearbeiten & Speichern · `•` Dirty-Marker.

---

## 🌳 JSON (bearbeitbar)

- [[sample.json|sample.json]] — valides, verschachteltes JSON → **aufklappbarer
  Baum**. Enthält alle Typen (String/Zahl/Bool/`null`/Objekt/Array, leere
  Container, Exponent, negative Zahl) und Umlaute/Escapes in `notes`.
- [[invalid.json|invalid.json]] — absichtlich kaputt (trailing comma + fehlende
  Klammer) → Fallback auf **rohen, syntaxhervorgehobenen Text** mit Hinweisbanner.
- [[large.json|large.json]] — > 1 MiB (per `gen-testdata.mjs` erzeugt) →
  Fallback auf **reine Textanzeige ohne Highlighting** (sonst friert der
  Webview ein).

**Prüfen:** Knoten auf-/zuklappen · ✎ / **Ctrl+E** öffnet CodeMirror mit
JSON-Syntax · Speichern & `•` Dirty-Marker · beide Fallbacks zeigen den Inhalt
statt einer leeren Seite.

---

## 📡 HTTP-Requests (bearbeitbar, Anzeige als Request-Karten)

- [[sample.http|sample.http]] — Datei-Variablen (`@host`, …), benannte
  `###`-Abschnitte, GET mit Query/Headern, POST mit JSON-Body (Body muss
  JSON-hervorgehoben sein), PUT mit HTTP-Version, **impliziter GET** (nackte
  URL), DELETE mit `//`-Kommentar davor und ein **Raw-Block** (Abschnitt ohne
  Request — darf den Parser nicht brechen).
- [[queries.rest|queries.rest]] — gleiche Syntax; prüft, dass die
  **`.rest`-Endung** erkannt wird.

**Prüfen:** Methoden-Badges (GET/POST/PUT/DELETE) · Header-Tabelle ·
Variablen-Liste oben · Raw-Block als Textkarte · ✎ öffnet CodeMirror; Karten
sind reine Anzeige (kein „Senden“-Button).

---

## 📄 PDF (read-only)

- [[sample.pdf|sample.pdf]] — minimales Ein-Seiten-PDF (per `gen-testdata.mjs`
  erzeugt). Muss im **iframe über das Asset-Protokoll** rendern und den
  Smoke-Test-Text zeigen.

**Prüfen:** Plattform-PDF-Renderer erscheint · **kein** ✎-Button · unter Linux
(webkit2gtk) ist keine Inline-Anzeige zu erwarten — das ist akzeptiert.

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
