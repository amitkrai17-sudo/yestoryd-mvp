import { notFound } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { 
  Star, 
  CheckCircle, 
  ArrowRight, 
  Calendar,
  BookOpen,
  Award
} from 'lucide-react';

interface Props {
  params: {
    subdomain: string;
  };
}

// Default coach data (works without database)
const DEFAULT_COACHES: Record<string, any> = {
  rucha: {
    coachId: 'coach_rucha',
    name: 'Rucha Rai',
    email: 'rucha@yestoryd.com',
    specialization: 'Early Reading, Phonics, Fluency',
    ageGroups: '4-12',
    totalSessions: 150,
    rating: 5.0,
    subdomain: 'rucha',
  },
};

// Try to get coach from database, fallback to defaults
async function getCoach(subdomain: string) {
  // First check default coaches
  const defaultCoach = DEFAULT_COACHES[subdomain.toLowerCase()];
  
  // Try database if configured
  try {
    const { isGoogleConfigured } = await import('@/lib/google/auth');
    if (isGoogleConfigured()) {
      const { sheetsDB } = await import('@/lib/google/sheets');
      const dbCoach = await sheetsDB.getCoachBySubdomain(subdomain);
      if (dbCoach) return dbCoach;
    }
  } catch (error) {
    console.log('Database not available, using default coach data');
  }
  
  return defaultCoach || null;
}

export default async function CoachPage({ params }: Props) {
  const { subdomain } = params;
  
  const coach = await getCoach(subdomain);

  if (!coach) {
    notFound();
  }

  const testimonials = [
    {
      name: 'Priya S.',
      child: 'Age 7',
      text: `${coach.name} is amazing! My son's reading improved dramatically in just a few weeks.`,
      rating: 5,
    },
    {
      name: 'Rahul G.',
      child: 'Age 10',
      text: 'The personalized attention made all the difference for my daughter. Highly recommend!',
      rating: 5,
    },
    {
      name: 'Anita M.',
      child: 'Age 5',
      text: 'So patient with young readers. My child actually looks forward to reading sessions now!',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      <Header variant="coach" coachName={coach.name} coachSubdomain={subdomain} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-[#FF0099]/10 via-purple-900/20 to-surface-0 py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-10">
              <div className="md:w-1/3 text-center">
                <div className="w-40 h-40 bg-gradient-to-br from-[#FF0099] to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FF0099]/30">
                  <span className="text-7xl">👩‍🏫</span>
                </div>
                <div className="flex items-center justify-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-text-secondary">{coach.rating} rating • {coach.totalSessions}+ sessions</p>
              </div>

              <div className="md:w-2/3 text-center md:text-left">
                <Badge className="mb-4 bg-[#FF0099]/20 text-[#FF0099] border-[#FF0099]/30">Reading Specialist</Badge>
                <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                  {coach.name}
                </h1>
                <p className="text-xl text-text-secondary mb-6">
                  Helping children ages {coach.ageGroups} discover the joy of reading through
                  personalized coaching and proven techniques.
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {coach.specialization.split(',').map((spec: string, i: number) => (
                    <Badge key={i} variant="secondary" className="bg-surface-2 text-text-secondary border-border">{spec.trim()}</Badge>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <Link href="/assessment">
                    <Button size="lg" className="bg-gradient-to-r from-[#FF0099] to-purple-600 hover:from-[#FF0099]/90 hover:to-purple-700 text-white rounded-full px-8">
                      Reading Test - Free
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/book">
                    <Button size="lg" variant="outline" className="border-2 border-[#FF0099]/50 text-[#FF0099] hover:bg-[#FF0099]/10 rounded-full px-8">
                      <Calendar className="w-5 h-5 mr-2" />
                      Book Free Session
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="py-16 bg-surface-1">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl font-bold text-white mb-6">About Me</h2>
            <p className="text-lg text-text-secondary mb-8">
              With years of experience in reading education, I've helped hundreds of children
              transform from struggling readers to confident bookworms. My approach combines
              proven phonics techniques with engaging, personalized lessons that make learning fun.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-border bg-surface-2">
                <CardContent className="p-6 text-center">
                  <Award className="w-10 h-10 text-[#FF0099] mx-auto mb-3" />
                  <h3 className="font-semibold mb-2 text-white">Certified Specialist</h3>
                  <p className="text-sm text-text-tertiary">Expert training in reading development</p>
                </CardContent>
              </Card>
              <Card className="border-border bg-surface-2">
                <CardContent className="p-6 text-center">
                  <BookOpen className="w-10 h-10 text-[#FF0099] mx-auto mb-3" />
                  <h3 className="font-semibold mb-2 text-white">{coach.totalSessions}+ Sessions</h3>
                  <p className="text-sm text-text-tertiary">Proven track record of success</p>
                </CardContent>
              </Card>
              <Card className="border-border bg-surface-2">
                <CardContent className="p-6 text-center">
                  <Star className="w-10 h-10 text-[#FF0099] mx-auto mb-3" />
                  <h3 className="font-semibold mb-2 text-white">{coach.rating} Rating</h3>
                  <p className="text-sm text-text-tertiary">Loved by parents and children</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* What's Included */}
        <section className="py-16 bg-surface-0">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              What's Included with Coaching
            </h2>

            <Card className="border-2 border-[#FF0099]/30 bg-surface-1">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <p className="text-sm text-[#FF0099] font-medium mb-2">6-SESSION PACKAGE</p>
                  <p className="text-4xl font-bold text-white">₹5,999</p>
                  <p className="text-text-tertiary">Everything you need for reading success</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    '6 one-hour personalized coaching sessions',
                    'AI-powered reading assessment',
                    'Custom learning plan',
                    'Progress tracking & reports',
                    'FREE eLearning Library access',
                    'FREE Storytelling sessions',
                    'FREE Physical class access',
                    'WhatsApp support',
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-text-secondary">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 text-center">
                  <Link href="/assessment">
                    <Button size="lg" className="bg-gradient-to-r from-[#FF0099] to-purple-600 hover:from-[#FF0099]/90 hover:to-purple-700 text-white rounded-full px-10">
                      Reading Test - Free
                    </Button>
                  </Link>
                  <p className="text-sm text-text-tertiary mt-3">
                    First 30-min consultation is FREE
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-16 bg-surface-1">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              What Parents Say
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, i) => (
                <Card key={i} className="border-border bg-surface-2">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-text-secondary mb-4 text-sm">"{testimonial.text}"</p>
                    <div>
                      <div className="font-semibold text-white text-sm">{testimonial.name}</div>
                      <div className="text-xs text-text-tertiary">Parent of child, {testimonial.child}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-[#FF0099] to-purple-600 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Take a free assessment to see where your child stands, then book a free 30-minute
              consultation to discuss a personalized plan.
            </p>
            <Link href="/assessment">
              <Button size="lg" className="bg-white text-[#FF0099] hover:bg-white/90 rounded-full px-10">
                Reading Test - Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer variant="coach" coachName={coach.name} />
    </div>
  );
}
