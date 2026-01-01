export default function AssessmentLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-800 flex items-center justify-center p-4">
      <div className="text-center">
        {/* Animated book/reading icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Book base */}
          <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse"></div>
          
          {/* Floating books animation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl animate-bounce">📖</span>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          Preparing Your Assessment
        </h2>
        
        <p className="text-purple-200 mb-6">
          Getting everything ready for your reading journey...
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
