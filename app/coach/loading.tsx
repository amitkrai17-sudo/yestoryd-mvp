export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-surface-3 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-brand-primary rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-text-secondary font-medium">Loading...</p>
      </div>
    </div>
  );
}
