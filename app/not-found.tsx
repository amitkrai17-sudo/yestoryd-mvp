import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-md w-full text-center">
        {/* Fun 404 illustration */}
        <div className="relative mb-8">
          <div className="text-9xl font-bold text-purple-100">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">📚❓</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h1>
        
        <p className="text-gray-600 mb-8">
          Looks like this page went on a reading adventure and got lost! 
          Let&apos;s get you back on track.
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Homepage
          </Link>
          
          <Link
            href="/assessment"
            className="block w-full bg-white text-purple-600 font-medium py-3 px-6 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-colors"
          >
            Take Free Assessment
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/about" className="text-purple-600 hover:underline">
              About Us
            </Link>
            <Link href="/parent" className="text-purple-600 hover:underline">
              Parent Dashboard
            </Link>
            <Link href="/coach" className="text-purple-600 hover:underline">
              Coach Portal
            </Link>
            <a 
              href="https://wa.me/918976287997" 
              className="text-green-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
