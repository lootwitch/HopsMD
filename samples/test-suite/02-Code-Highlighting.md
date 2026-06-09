# ② Syntax-Highlighting

Zurück zum [[00-START-HERE|Start]].

Bei jedem Codeblock erscheint beim Hovern eine Toolbar oben rechts mit
**Kopieren** und **im Editor öffnen**. Sprach-Label links prüfen.

## TypeScript

```ts
interface Recipe {
  name: string;
  hops: string[];
  og: number;
}

function brew(r: Recipe): string {
  const ibu = r.hops.length * 12.5;
  return `${r.name}: OG ${r.og.toFixed(3)}, ~${ibu} IBU`;
}

console.log(brew({ name: 'Citra Pale', hops: ['Citra', 'Mosaic'], og: 1.052 }));
```

## Rust

```rust
fn ibu(hop_oz: f64, alpha: f64, util: f64, volume_gal: f64) -> f64 {
    (hop_oz * alpha * util * 7489.0) / volume_gal
}

fn main() {
    println!("{:.1} IBU", ibu(2.0, 0.12, 0.25, 5.0));
}
```

## Python

```python
def tinseth(hop_oz: float, alpha: float, util: float, vol: float) -> float:
    """Approximate IBU contribution (Tinseth)."""
    return (hop_oz * alpha * util * 7489) / vol

print(f"{tinseth(2.0, 0.12, 0.25, 5.0):.1f} IBU")
```

## JSON

```json
{
  "recipe": "West Coast IPA",
  "og": 1.062,
  "fg": 1.012,
  "hops": [
    { "name": "Simcoe", "grams": 30, "minutes": 60 },
    { "name": "Citra", "grams": 50, "minutes": 0 }
  ]
}
```

## Bash / Shell

```bash
#!/usr/bin/env bash
set -euo pipefail
for hop in Citra Mosaic Simcoe; do
  echo "Adding $hop to the whirlpool"
done
```

## SQL

```sql
SELECT name, alpha_acid
FROM hops
WHERE origin = 'USA'
ORDER BY alpha_acid DESC
LIMIT 5;
```

## Ohne Sprachangabe (auto-detect)

```
const PI = 3.14159;
const area = (r) => PI * r * r;
```

## Eingerückter Block (4 Spaces)

    # eingerückter Codeblock
    echo "Toolbar sollte auch hier erscheinen"
