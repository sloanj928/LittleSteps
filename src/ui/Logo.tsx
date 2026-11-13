import logo from './logo.json';

// The brand's own colours, fixed under every palette: the app icon, or the
// footprints alone in deep sage for use on a light page.
function Foot({ x, y, scale, rotate, mirror }: (typeof logo.feet)[number]) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d={logo.sole} transform={logo.soleTransform} />
      <g transform={mirror ? 'scale(-1 1)' : undefined}>
        {logo.toes.map(([cx, cy, r]) => (
          <circle key={cx} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </g>
  );
}

export function Logo({ size = 72, title = 'Little Steps' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${logo.size} ${logo.size}`} role="img" aria-label={title}>
      <rect width={logo.size} height={logo.size} rx={logo.radius} fill={logo.sage} />
      <g fill={logo.cream}>
        {logo.feet.map((f) => (
          <Foot key={f.x} {...f} />
        ))}
      </g>
    </svg>
  );
}
