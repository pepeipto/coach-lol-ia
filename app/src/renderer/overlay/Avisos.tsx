export interface AvisoVisible {
  id: number;
  texto: string;
}

/** Cada aviso se desvanece con una animación CSS de 5 s; Overlay lo retira al terminar. */
export function Avisos({ avisos }: { avisos: AvisoVisible[] }) {
  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className="aviso">
          {a.texto}
        </div>
      ))}
    </div>
  );
}
