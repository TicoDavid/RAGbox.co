export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--text-tertiary)] font-[family-name:var(--font-jakarta)]">
          Loading...
        </p>
      </div>
    </div>
  )
}
