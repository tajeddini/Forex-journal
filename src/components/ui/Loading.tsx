export function Loading({ message = 'در حال بارگذاری...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
        <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin" />
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loading />
    </div>
  );
}
