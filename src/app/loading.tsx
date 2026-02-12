export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0A192F]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400 font-[family-name:var(--font-jakarta)]">
          Loading...
        </p>
      </div>
    </div>
  )
}
