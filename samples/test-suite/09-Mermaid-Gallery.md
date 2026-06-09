# ⑨ Mermaid-Galerie

Zurück zum [[00-START-HERE|Start]].

Jeder Mermaid-Block hat eine eigene Toolbar: **Renderer ↔ Quelltext umschalten**,
**Vollbild**, Kopieren, im Editor öffnen. Bitte beide Toggle-Zustände und Vollbild
testen. Ein kaputtes Diagramm darf die Seite **nicht** mitreißen (siehe
[[11-Edge-Cases|Grenzfälle]]).

## Flowchart

```mermaid
flowchart LR
    A[Schroten] --> B[Maischen 60 min]
    B --> C[Läutern]
    C --> D[Kochen 60 min]
    D --> E{Hopfengabe}
    E -->|60 min| F[Bittern]
    E -->|0 min| G[Aroma]
    F --> H[Kühlen]
    G --> H
    H --> I[Gären]
    I --> J[Abfüllen]
```

## Sequenzdiagramm

```mermaid
sequenceDiagram
    participant U as User
    participant V as Viewer
    participant R as Rust-Shell
    participant FS as Dateisystem
    U->>V: Datei öffnen
    V->>R: tap_recipe(path)
    R->>FS: read(path)
    FS-->>R: UTF-8 Inhalt
    R-->>V: Inhalt
    V-->>U: gerendertes Markdown
```

## Klassendiagramm

```mermaid
classDiagram
    class Recipe {
      +String name
      +float og
      +brew() String
    }
    class Hop {
      +String name
      +float alpha
    }
    Recipe "1" --> "*" Hop : enthält
```

## Zustandsdiagramm

```mermaid
stateDiagram-v2
    [*] --> Viewing
    Viewing --> Editing: Ctrl+E
    Editing --> Viewing: Ctrl+S (save)
    Editing --> Viewing: Esc (cancel)
    Editing --> Conflict: external write
    Conflict --> Viewing: reload
    Conflict --> Editing: keep mine
```

## Gantt

```mermaid
gantt
    title Brautag
    dateFormat HH:mm
    axisFormat %H:%M
    section Maischen
    Einmaischen      :a1, 08:00, 10m
    Rasten           :a2, after a1, 60m
    section Kochen
    Aufheizen        :b1, after a2, 20m
    Kochen           :b2, after b1, 60m
```

## Tortendiagramm

```mermaid
pie title Schüttung
    "Pilsner Malz" : 70
    "Münchner Malz" : 20
    "Carahell" : 7
    "Sauermalz" : 3
```

## ER-Diagramm

```mermaid
erDiagram
    RECIPE ||--o{ HOP_ADDITION : has
    RECIPE {
      string name
      float og
    }
    HOP_ADDITION {
      string hop
      int grams
      int minutes
    }
```
