function ConfirmDialog({
  open = false,
  title = 'Confirmation',
  message = '',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  loading = false,
  loadingLabel = 'Chargement...',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const confirmClasses =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-300'
      : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-6 text-slate-600">{message}</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70 ${confirmClasses}`}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
