# ④ Mathe (KaTeX)

Zurück zum [[00-START-HERE|Start]].

## Inline

Die Masse-Energie-Äquivalenz lautet $E = mc^2$, und die Stammwürze hängt mit
dem Alkoholgehalt über $ABV \approx (OG - FG) \times 131.25$ zusammen.

Griechisch & Indizes inline: $\alpha + \beta_2 = \gamma^{n}$.

## Display-Block

Das Integral von $x^2$ über $[0, 1]$:

$$
\int_0^1 x^2 \,dx = \frac{1}{3}
$$

Eulers Identität:

$$
e^{i\pi} + 1 = 0
$$

## Komplexer

Eine Matrix:

$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
\begin{pmatrix} x \\ y \end{pmatrix}
=
\begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}
$$

Eine Summe mit Grenzen:

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
$$

Ein Bruch mit Wurzel:

$$
\phi = \frac{1 + \sqrt{5}}{2}
$$

## Fehlerfall (throwOnError: false)

Ein absichtlich kaputter Ausdruck sollte **nicht** die Seite zerstören,
sondern lokal als Fehler erscheinen: $\frac{1}{$
