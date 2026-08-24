interface DraftBannerProps {
  onDiscard: () => void;
}

/** Aviso de que se restauró un borrador sin guardar, con opción de descartarlo. */
export function DraftBanner({ onDiscard }: DraftBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-md bg-info/10 px-3 py-2 text-xs text-info">
      <span>Recuperamos un borrador sin guardar de un registro anterior.</span>
      <button
        type="button"
        className="font-medium underline underline-offset-2 hover:no-underline shrink-0 ml-2"
        onClick={onDiscard}
      >
        Descartar borrador
      </button>
    </div>
  );
}
