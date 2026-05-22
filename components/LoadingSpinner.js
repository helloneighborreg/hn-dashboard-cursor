export function Spinner({ size = 'md' }) {
  const s = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];
  return (
    <div className={`${s} border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin`} />
  );
}

export function PageLoader({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Spinner size="lg" />
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
        <span className="text-2xl">🏡</span>
      </div>
      <p className="font-semibold text-dark">{title}</p>
      {message && <p className="text-muted text-sm max-w-xs">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <p className="font-semibold text-dark">Something went wrong</p>
      <p className="text-muted text-sm max-w-sm px-4 break-words">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm hover:bg-brand-600 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
