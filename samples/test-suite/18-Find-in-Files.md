---
title: Find in Files (Ctrl+Shift+F)
tags: [search, brewhouse]
feature: find-in-files
unique-marker: HOPSMD-FINDABLE-MARKER-XYZ
---

# ⑱ Find in Files

**Ctrl+Shift+F** öffnet ein zentriertes Such-Overlay, das die komplette
Sudhaus-Struktur durchsucht (Volltext, alle lesbaren Datei-Typen).

Diese Datei enthält absichtlich einen einzigartigen Marker, den keine andere
Datei in der Test-Suite hat: **HOPSMD-FINDABLE-MARKER-XYZ**

## Häufige Suchbegriffe

Das Wort *brauen* taucht hier mehrfach auf: brauen, Brauen, gebraut, Brauer.
Auch *Sudhaus* mehrfach für Wiederholungs-Tests: Sudhaus eins, Sudhaus zwei,
Sudhaus drei.

```python
def brauen(malz, hopfen, wasser):
    return "Bier"
```

## Checkliste

- [ ] **Ctrl+Shift+F** → Overlay öffnet sich, Input ist fokussiert
- [ ] "HOPSMD-FINDABLE" eingeben → genau 1 Treffer in 1 Datei (dieser)
- [ ] "brauen" eingeben → Treffer in mehreren Dateien (auch in Code-Block)
- [ ] **Aa**-Toggle anschalten → "brauen" findet `brauen` aber nicht `Brauen`
- [ ] Toggle aus → beide werden gefunden
- [ ] Klick auf einen Treffer → öffnet die Datei
- [ ] **Esc** oder Klick außerhalb → schließt das Overlay
- [ ] Such-Eingabe mit 1 Zeichen → Hinweis "mindestens 2 Zeichen"
- [ ] Sehr seltene Eingabe (z. B. "qzxqzx") → "Keine Treffer"
- [ ] Bei sehr vielen Treffern: capped bei 500 total / 50 pro Datei
- [ ] Noise-Ordner wie `node_modules`, `.git` werden nicht durchsucht
