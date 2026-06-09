# ⑩ Bilder & Assets

Zurück zum [[00-START-HERE|Start]].

Relative Bildpfade werden über das Tauri-Asset-Protokoll aufgelöst.

## Standard-Markdown-Bild (relativ)

![HopsMD Logo](assets/hops-logo.svg)

## Mit Titel-Attribut

![Logo mit Titel](assets/hops-logo.svg "Das HopsMD-Logo")

## Wiki-Embed (gleiche Datei, andere Syntax)

![[assets/hops-logo.svg]]

## Externes Bild (über http — sollte NICHT umgeschrieben werden)

![Externes Platzhalterbild](https://placehold.co/200x80/png?text=HopsMD)

## Daten-URI (inline, sollte unverändert bleiben)

![Roter Punkt](data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='18' fill='%23c0392b'/></svg>)

> [!WARNING]
> Wenn ein Bild **nicht** lädt, liegt es meist daran, dass `samples/test-suite/`
> nicht als Brewhouse-Root geöffnet wurde — relative Pfade werden gegen das
> Verzeichnis der Datei aufgelöst.
