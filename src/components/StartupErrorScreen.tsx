import { NewerSchemaError } from '../migrations'

export default function StartupErrorScreen({ error }: { error: unknown }) {
  const isNewer = error instanceof NewerSchemaError
  return (
    <div
      className="h-full bg-slate-950 text-slate-100 max-w-md mx-auto p-6 flex flex-col justify-center gap-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <h1 className="text-xl font-bold">
        {isNewer ? 'Update needed' : "Couldn't open your data"}
      </h1>
      <p className="text-slate-400 text-sm">
        {isNewer
          ? (error as NewerSchemaError).message
          : 'The app could not open its storage. Nothing has been deleted. Try reloading; if this keeps happening, check that the browser is not in private mode and has free space.'}
      </p>
      {!isNewer && error instanceof Error && (
        <p className="text-xs text-slate-500 font-mono break-words">{error.message}</p>
      )}
      <button
        onClick={() => window.location.reload()}
        className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
      >
        Reload
      </button>
    </div>
  )
}
