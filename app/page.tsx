'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-pink-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="font-bold text-xl text-gray-900">Yestoryd</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/assessment" className="text-gray-600 hover:text-pink-600 transition-colors">
                Free Assessment
              </Link>
              <Link href="/book" className="text-gray-600 hover:text-pink-600 transition-colors">
                Book Session
              </Link>
            </nav>
            <Link 
              href="/assessment"
              className="bg-gradient-to-r from-pink-500 to-pink-600 text-white font-semibold py-2 px-4 rounded-xl hover:from-pink-600 hover:to-pink-700 transition-all shadow-md"
            >
              Start Free Test
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            AI-Powered Reading Intelligence for Children
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Personalized reading assessment and coaching for children aged 4-15. 
            Take a free AI assessment and get matched with expert coaches.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/assessment"
              className="bg-gradient-to-r from-pink-500 to-pink-600 text-white font-semibold py-4 px-8 rounded-xl hover:from-pink-600 hover:to-pink-700 transition-all shadow-lg text-lg"
            >
              🎯 Take Free Assessment
            </Link>
            <Link 
              href="/book"
              className="border-2 border-pink-500 text-pink-600 font-semibold py-4 px-8 rounded-xl hover:bg-pink-50 transition-all text-lg"
            >
              📅 Book a Session
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI Assessment</h3>
              <p className="text-gray-600">
                Advanced AI analyzes reading fluency, pronunciation, and comprehension in real-time.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="text-4xl mb-4">👩‍🏫</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Expert Coaches</h3>
              <p className="text-gray-600">
                Get matched with certified reading coaches for personalized 1-on-1 sessions.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Track Progress</h3>
              <p className="text-gray-600">
                Monitor improvement with detailed reports and actionable insights.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2024 Yestoryd. AI-Powered Reading Intelligence for Children.
          </p>
        </div>
      </footer>
    </div>
  );
}
