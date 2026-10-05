"use client";

import { memo, useMemo } from "react";

function rng(s) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;

    let t = Math.imul(
      s ^ (s >>> 15),
      1 | s
    );

    t =
      (t +
        Math.imul(
          t ^ (t >>> 7),
          61 | t
        )) ^
      t;

    return (
      ((t ^ (t >>> 14)) >>> 0) /
      4294967296
    );
  };
}

// Every seed grows a different, repeatable fingerprint.
function Print({
  seed = 1,
  ink = 0.8,
  rot = 0,
  size = 120,
}) {
  const rings = useMemo(() => {
    const r = rng(seed);

    const waves = Array.from(
      { length: 4 },
      (_, k) => ({
        a:
          0.5 + r() * 0.9,
        f: k + 2,
        p:
          r() * 6.28,
      })
    );

    const cx =
      (r() - 0.5) * 8;

    const cy =
      (r() - 0.5) * 10;

    const lean =
      0.3 + r() * 0.7;

    const out = [];

    for (
      let i = 1;
      i <= 24;
      i++
    ) {
      let d = "";

      for (
        let j = 0;
        j <= 80;
        j++
      ) {
        const a =
          (j / 80) *
          Math.PI *
          2;

        let w = 0;

        for (const q of waves) {
          w +=
            q.a *
            Math.sin(
              q.f * a +
                q.p +
                i * 0.05
            );
        }

        const rad =
          i *
          2.5 *
          (1 +
            w *
              (0.015 +
                (i / 24) *
                  0.05));

        const x =
          cx +
          rad *
            Math.cos(a) *
            0.82;

        const y =
          cy -
          i * lean +
          rad *
            Math.sin(a) *
            1.12;

        d +=
          (j ? "L" : "M") +
          x.toFixed(1) +
          " " +
          y.toFixed(1);
      }

      out.push({
        d,

        dash: `${(
          6 +
          r() * 30
        ).toFixed(0)} ${(
          r() * 2.5
        ).toFixed(1)}`,
      });
    }

    return out;
  }, [seed]);

  const id = `c${seed}`;

  return (
    <svg
      viewBox="-50 -62 100 124"
      width={size}
      height={size * 1.24}
      aria-hidden="true"
    >
      <clipPath id={id}>
        <ellipse
          cx="0"
          cy="0"
          rx="39"
          ry="52"
        />
      </clipPath>

      <g
        transform={`rotate(${rot})`}
        clipPath={`url(#${id})`}
        filter="url(#rough)"
        fill="none"
        stroke="#22a3ea"
        strokeWidth={
          0.9 + ink * 0.9
        }
        strokeOpacity={
          0.16 + ink * 0.84
        }
        strokeLinecap="round"
      >
        {rings.map(
          (p, i) => (
            <path
              key={i}
              d={p.d}
              strokeDasharray={
                p.dash
              }
            />
          )
        )}
      </g>
    </svg>
  );
}

export default memo(Print);