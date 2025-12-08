import Link from 'next/link';
import { 
  BookOpen, 
  Video, 
  Mic, 
  Headphones, 
  Building2,
  Star,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Play
} from 'lucide-react';

export default function HomePage() {
  const services = [
    {
      icon: BookOpen,
      title: 'Personalized Coaching',
      description: '1-on-1 sessions with expert reading coaches tailored to your child\'s unique needs',
      href: '/services/coaching',
      color: 'bg-[#FF2D92]',
    },
    {
      icon: Video,
      title: 'eLearning Library',
      description: 'Self-paced video courses and interactive modules designed for all ages',
      href: '/services/elearning',
      color: 'bg-[#3B82F6]',
    },
    {
      icon: Mic,
      title: 'Storytelling Sessions',
      description: 'Live interactive storytelling that sparks imagination and love for reading',
      href: '/services/storytelling',
      color: 'bg-[#FBBF24]',
    },
    {
      icon: Headphones,
      title: 'Podcasts',
      description: 'Expert tips and insights for parents on child reading development',
      href: '/services/podcasts',
      color: 'bg-[#10B981]',
    },
    {
      icon: Building2,
      title: 'Physical Classes',
      description: 'In-person workshops and group sessions in your city',
      href: '/services/physical-classes',
      color: 'bg-[#8B5CF6]',
    },
  ];

  const testimonials = [
    {
      name: 'Priya Sharma',
      child: 'Aarav, Age 7',
      text: 'My son went from struggling with basic words to reading chapter books in just 3 months!',
      rating: 5,
    },
    {
      name: 'Rahul Gupta',
      child: 'Ananya, Age 10',
      text: 'The AI assessment was eye-opening. The coaching has been transformative for our daughter.',
      rating: 5,
    },
    {
      name: 'Fatima Khan',
      child: 'Zara, Age 5',
      text: 'Rucha\'s patience with young readers is remarkable. Zara now loves reading time!',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF2D92] to-[#FF6B6B] rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <span className="text-[#FF2D92]">Yest</span>
              <span className="text-gray-900">or</span>
              <span className="text-[#FBBF24]">yd</span>
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/services/coaching" className="text-gray-600 hover:text-[#FF2D92] font-medium transition-colors">Coaching</Link>
            <Link href="/services/elearning" className="text-gray-600 hover:text-[#FF2D92] font-medium transition-colors">eLearning</Link>
            <Link href="/services/storytelling" className="text-gray-600 hover:text-[#FF2D92] font-medium transition-colors">Storytelling</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-[#FF2D92] font-medium transition-colors">Pricing</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/assessment">
              <button className="hidden sm:block px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all active:scale-95">
                Free Assessment
              </button>
            </Link>
            <Link href="/coach/join">
              <button className="px-5 py-2.5 bg-[#3B82F6] text-white font-semibold rounded-full hover:bg-[#2563EB] transition-all active:scale-95">
                Become a Coach
              </button>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-28 overflow-hidden bg-white">
          {/* Background decorations */}
          <div className="absolute top-10 left-10 w-64 h-64 bg-[#FF2D92]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#3B82F6]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FBBF24]/10 rounded-full blur-3xl"></div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-[#FBBF24] px-5 py-2 rounded-full mb-8 shadow-lg">
                <Sparkles className="w-5 h-5 text-gray-900" />
                <span className="text-sm font-bold text-gray-900">AI-Powered Reading Assessment</span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-black text-gray-900 mb-6 leading-tight" style={{ fontFamily: 'system-ui, sans-serif' }}>
                Spark the Love of{' '}
                <span className="text-[#FF2D92]">Reading</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Personalized coaching, interactive learning, and expert guidance to help every child become a 
                <span className="text-[#FBBF24] font-bold"> confident reader</span>.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/assessment">
                  <button className="w-full sm:w-auto px-10 py-5 bg-[#FF2D92] text-white font-bold text-lg rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95">
                    Start Reading
                    <ArrowRight className="w-5 h-5 ml-2 inline" />
                  </button>
                </Link>
                <Link href="#how-it-works">
                  <button className="w-full sm:w-auto px-10 py-5 bg-white border-2 border-[#3B82F6] text-[#3B82F6] font-bold text-lg rounded-full hover:bg-[#3B82F6] hover:text-white transition-all active:scale-95">
                    Learn More
                  </button>
                </Link>
              </div>
              
              <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2 bg-green-100 px-4 py-2 rounded-full">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-semibold">Free Assessment</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-full">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-700 font-semibold">Expert Coaches</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-full">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  <span className="text-purple-700 font-semibold">Ages 4-15</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section - Bento Grid */}
        <section className="py-20 bg-[#FAFAF9]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4">
                Complete Reading{' '}
                <span className="text-[#3B82F6]">Development</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Everything your child needs to become a confident, fluent reader
              </p>
            </div>
            
            {/* Bento Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {services.map((service, index) => (
                <Link key={service.title} href={service.href}>
                  <div className={`${index === 0 ? 'lg:col-span-2' : ''} bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group h-full`}>
                    <div className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      <service.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {service.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed text-lg">
                      {service.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4">
                How It{' '}
                <span className="text-[#FBBF24]">Works</span>
              </h2>
              <p className="text-xl text-gray-600">
                Three simple steps to start your child's reading journey
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: 1,
                  title: 'Free Assessment',
                  description: 'Record your child reading a short passage. Our AI analyzes fluency, pronunciation, and comprehension.',
                  color: 'bg-[#FF2D92]',
                },
                {
                  step: 2,
                  title: 'Get Matched',
                  description: 'Receive instant results and get matched with the perfect coach based on your child\'s needs.',
                  color: 'bg-[#3B82F6]',
                },
                {
                  step: 3,
                  title: 'Start Learning',
                  description: 'Begin personalized coaching sessions and unlock access to all learning resources.',
                  color: 'bg-[#FBBF24]',
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className={`w-20 h-20 ${item.color} text-white rounded-3xl flex items-center justify-center text-3xl font-black mx-auto mb-6 shadow-lg ${item.color === 'bg-[#FBBF24]' ? 'text-gray-900' : ''}`}>
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="text-center mt-16">
              <Link href="/assessment">
                <button className="px-10 py-5 bg-[#FF2D92] text-white font-bold text-lg rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95">
                  Start Free Assessment
                  <ArrowRight className="w-5 h-5 ml-2 inline" />
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 bg-[#FAFAF9]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4">
                Simple,{' '}
                <span className="text-[#3B82F6]">Transparent</span> Pricing
              </h2>
              <p className="text-xl text-gray-600">
                One coaching package unlocks everything
              </p>
            </div>
            
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-[#3B82F6]">
                <div className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] p-8 text-center">
                  <span className="inline-block bg-[#FBBF24] text-gray-900 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
                    Most Popular
                  </span>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    6 Coaching Sessions
                  </h3>
                  <div className="text-5xl font-black text-white my-4">
                    ₹5,999
                  </div>
                </div>
                <div className="p-8">
                  <ul className="space-y-4 mb-8">
                    {[
                      '6 one-hour personalized coaching sessions',
                      'FREE Complete eLearning Library',
                      'FREE Live Storytelling Sessions',
                      'FREE Physical Class Access',
                      'FREE Podcast Library',
                      'Progress tracking & reports',
                      'WhatsApp support',
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700 text-lg">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/assessment">
                    <button className="w-full py-5 bg-[#FF2D92] text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95">
                      Get Started - First Session Free
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4">
                What Parents{' '}
                <span className="text-[#FBBF24]">Say</span>
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {testimonials.map((testimonial, i) => (
                <div key={i} className="bg-[#FAFAF9] rounded-3xl p-8 border border-gray-100">
                  <div className="flex gap-1 mb-6">
                    {Array.from({ length: testimonial.rating }).map((_, j) => (
                      <Star key={j} className="w-6 h-6 fill-[#FBBF24] text-[#FBBF24]" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed text-lg">"{testimonial.text}"</p>
                  <div className="border-t border-gray-200 pt-4">
                    <div className="font-bold text-gray-900 text-lg">{testimonial.name}</div>
                    <div className="text-[#3B82F6] font-medium">Parent of {testimonial.child}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Meet the Founder */}
        <section className="py-20 bg-[#FAFAF9]">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/3">
                <div className="w-56 h-56 bg-gradient-to-br from-[#FF2D92] to-[#FF6B6B] rounded-full flex items-center justify-center mx-auto shadow-2xl">
                  <span className="text-8xl">👩‍🏫</span>
                </div>
              </div>
              <div className="md:w-2/3 text-center md:text-left">
                <h2 className="text-4xl font-black text-gray-900 mb-2">Meet Rucha Rai</h2>
                <p className="text-[#FF2D92] font-bold text-xl mb-6">Founder & Head Reading Coach</p>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  With over 8 years of experience in early childhood education, I founded Yestoryd 
                  to make personalized reading coaching accessible to every family. Every child 
                  learns differently, and our AI-powered platform helps us understand exactly 
                  what each child needs to thrive.
                </p>
                <Link href="/about">
                  <button className="px-8 py-4 bg-white border-2 border-[#3B82F6] text-[#3B82F6] font-bold rounded-full hover:bg-[#3B82F6] hover:text-white transition-all active:scale-95">
                    Learn More About Us
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-[#FF2D92] to-[#FF6B6B]">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6">
              Ready to Start Your Child's Reading Journey?
            </h2>
            <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Take a free 5-minute assessment and get personalized recommendations instantly.
            </p>
            <Link href="/assessment">
              <button className="px-12 py-6 bg-white text-[#FF2D92] font-bold text-xl rounded-full shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all active:scale-95">
                Take Free Assessment Now
                <ArrowRight className="w-6 h-6 ml-3 inline" />
              </button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#FF2D92] to-[#FF6B6B] rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold">
                  <span className="text-[#FF2D92]">Yest</span>
                  <span className="text-white">or</span>
                  <span className="text-[#FBBF24]">yd</span>
                </span>
              </div>
              <p className="text-gray-400">
                Empowering children to become confident readers through personalized coaching and AI-powered assessments.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-[#FBBF24] mb-4">Services</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/services/coaching" className="hover:text-white transition-colors">Coaching</Link></li>
                <li><Link href="/services/elearning" className="hover:text-white transition-colors">eLearning</Link></li>
                <li><Link href="/services/storytelling" className="hover:text-white transition-colors">Storytelling</Link></li>
                <li><Link href="/services/podcasts" className="hover:text-white transition-colors">Podcasts</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-[#FBBF24] mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/coach/join" className="hover:text-white transition-colors">Become a Coach</Link></li>
                <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-[#FBBF24] mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>hello@yestoryd.com</li>
                <li>+91 98765 43210</li>
                <li>Mumbai, India</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>© 2024 Yestoryd. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
