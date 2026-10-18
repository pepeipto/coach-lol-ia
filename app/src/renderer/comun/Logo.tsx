/** Emblema de Coach LoL IA: un hexágono dorado con una «C» y un destello (SVG en línea, sin peticiones). */
export function Logo({ tamano = 28 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 32 32" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-oro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d9a6" />
          <stop offset="0.55" stopColor="#c8aa6e" />
          <stop offset="1" stopColor="#8a6d3b" />
        </linearGradient>
        <linearGradient id="logo-fondo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2236" />
          <stop offset="1" stopColor="#0a0e1a" />
        </linearGradient>
      </defs>
      <path d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75Z" fill="url(#logo-fondo)" stroke="url(#logo-oro)" strokeWidth="1.6" />
      <path
        d="M21.2 11.6a6.4 6.4 0 1 0 0 8.8"
        fill="none"
        stroke="url(#logo-oro)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M22.6 14.2l1.1 1.8 1.8 1.1-1.8 1.1-1.1 1.8-1.1-1.8-1.8-1.1 1.8-1.1Z" fill="#4f7cff" />
    </svg>
  );
}
