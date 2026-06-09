# ① Textformatierung

Zurück zum [[00-START-HERE|Start]].

## Überschriften

# H1 Überschrift
## H2 Überschrift
### H3 Überschrift
#### H4 Überschrift
##### H5 Überschrift
###### H6 Überschrift

## Betonung

- *kursiv* und _auch kursiv_
- **fett** und __auch fett__
- ***fett-kursiv***
- ~~durchgestrichen~~
- `inline code`
- Kombination: **fett mit `code` und *kursiv* darin**

## Absätze & Zeilenumbrüche

Das ist ein normaler Absatz. Er kann über mehrere Zeilen gehen, und der Umbruch
im Quelltext wird zusammengefasst (kein harter Umbruch, da `breaks: false`).

Ein zweiter Absatz, durch eine Leerzeile getrennt.

## Listen

### Ungeordnet (geschachtelt)

- Malz
  - Pilsner Malz
  - Münchner Malz
    - hell
    - dunkel
- Hopfen
- Hefe

### Geordnet

1. Maischen
2. Läutern
3. Kochen
   1. Bitterhopfen
   2. Aromahopfen
4. Gären

## Blockzitate (geschachtelt)

> Bier ist der Beweis, dass die Natur uns liebt.
>
> > Ein verschachteltes Zitat.
> >
> > — angeblich Benjamin Franklin (über Wein, aber egal)

## Trennlinie

Oben

---

Unten

## Links

- Extern: [Brewer's Friend](https://www.brewersfriend.com)
- Mit Titel: [Hover für Titel](https://example.com "Ein Titel-Tooltip")
- Autolink: <https://example.com>
- E-Mail: <mailto:hello@example.com>

## Inline-HTML (sollte sanitisiert durchkommen)

Ein <abbr title="India Pale Ale">IPA</abbr> mit <kbd>Ctrl</kbd>+<kbd>S</kbd>.
