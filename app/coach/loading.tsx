export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
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
