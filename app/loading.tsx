export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="text-center">
        {/* Animated book loader */}
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-pink-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-pink-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}
