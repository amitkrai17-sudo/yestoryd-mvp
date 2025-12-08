import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { 
  BookOpen, 
  Video, 
  Mic, 
  Headphones, 
  Building2,
  Star,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function HomePage() {
  const services = [
    {
      icon: BookOpen,
      title: 'Personalized Coaching',
      description: '1-on-1 sessions with expert reading coaches tailored to your child\'s unique needs',
      href: '/services/coaching',
    },
    {
      icon: Video,
      title: 'eLearning Library',
      description: 'Self-paced video courses and interactive modules designed for all ages',
      href: '/services/elearning',
    },
    {
      icon: Mic,
      title: 'Storytelling Sessions',
      description: 'Live interactive storytelling that sparks imagination and love for reading',
      href: '/services/storytelling',
    },
    {
      icon: Headphones,
      title: 'Podcasts',
      description: 'Expert tips and insights for parents on child reading development',
      href: '/services/podcasts',
    },
    {
      icon: Building2,
      title: 'Physical Classes',
      description: 'In-person workshops and group sessions in your city',
      href: '/services/physical-classes',
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
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-24 lg:py-32 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl"></div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-5 py-2.5 rounded-full shadow-sm mb-8">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-semibold text-blue-700">AI-Powered Reading Assessment</span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                Unlock Your Child's{' '}
                <span className="text-blue-600">Reading Potential</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Personalized coaching, interactive learning, and expert guidance to help every child become a 
                <span className="text-yellow-600 font-semibold"> confident reader</span>.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/assessment">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                    Take Free Assessment
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/services/coaching">
                  <Button size="lg" variant="outline" className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-8 py-6 text-lg rounded-full">
                    Explore Coaching
                  </Button>
                </Link>
              </div>
              
              <div className="mt-12 flex items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Free Assessment</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Expert Coaches</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Ages 4-15</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Complete Reading <span className="text-blue-600">Development</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Everything your child needs to become a confident, fluent reader
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service) => (
                <Link key={service.title} href={service.href}>
                  <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer border-gray-200">
                    <CardContent className="p-8">
                      <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                        <service.icon className="w-7 h-7 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">
                        {service.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {service.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                How It <span className="text-yellow-500">Works</span>
              </h2>
              <p className="text-xl text-gray-600">
                Three simple steps to start your child's reading journey
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
              {[
                {
                  step: 1,
                  title: 'Free Assessment',
                  description: 'Record your child reading a short passage. Our AI analyzes fluency, pronunciation, and comprehension.',
                },
                {
                  step: 2,
                  title: 'Get Matched',
                  description: 'Receive instant results and get matched with the perfect coach based on your child\'s needs.',
                },
                {
                  step: 3,
                  title: 'Start Learning',
                  description: 'Begin personalized coaching sessions and unlock access to all learning resources.',
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-lg">
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
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-6 text-lg rounded-full shadow-lg">
                  Start Free Assessment
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Simple, <span className="text-blue-600">Transparent</span> Pricing
              </h2>
              <p className="text-xl text-gray-600">
                One coaching package unlocks everything
              </p>
            </div>
            
            <div className="max-w-lg mx-auto">
              <Card className="border-2 border-blue-200 shadow-xl overflow-hidden">
                <div className="bg-blue-600 p-6 text-center">
                  <span className="inline-block bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold mb-3">
                    Most Popular
                  </span>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    6 Coaching Sessions
                  </h3>
                  <div className="text-5xl font-bold text-white my-4">
                    ₹5,999
                  </div>
                </div>
                <CardContent className="p-8">
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
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/assessment">
                    <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg rounded-full">
                      Get Started - First Session Free
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                What Parents <span className="text-yellow-500">Say</span>
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {testimonials.map((testimonial, i) => (
                <Card key={i} className="border-gray-200">
                  <CardContent className="p-8">
                    <div className="flex gap-1 mb-6">
                      {Array.from({ length: testimonial.rating }).map((_, j) => (
                        <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.text}"</p>
                    <div className="border-t pt-4">
                      <div className="font-bold text-gray-900">{testimonial.name}</div>
                      <div className="text-sm text-blue-600">Parent of {testimonial.child}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Meet the Founder */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/3">
                <div className="w-56 h-56 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-7xl">👩‍🏫</span>
                </div>
              </div>
              <div className="md:w-2/3 text-center md:text-left">
                <h2 className="text-4xl font-bold text-gray-900 mb-2">Meet Rucha Rai</h2>
                <p className="text-blue-600 font-semibold text-lg mb-6">Founder & Head Reading Coach</p>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  With over 8 years of experience in early childhood education, I founded Yestoryd 
                  to make personalized reading coaching accessible to every family. Every child 
                  learns differently, and our AI-powered platform helps us understand exactly 
                  what each child needs to thrive.
                </p>
                <Link href="/about">
                  <Button variant="outline" className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 rounded-full px-8">
                    Learn More About Us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-blue-600">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Start Your Child's Reading Journey?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Take a free 5-minute assessment and get personalized recommendations instantly.
            </p>
            <Link href="/assessment">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-12 py-7 text-xl rounded-full shadow-lg">
                Take Free Assessment Now
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
