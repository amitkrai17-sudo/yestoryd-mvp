import { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { AssessmentForm } from '@/components/assessment/AssessmentForm';

export const metadata: Metadata = {
  title: 'Free Reading Assessment | Yestoryd',
  description: 'Get a free AI-powered reading assessment for your child. Instant feedback on fluency, pronunciation, and comprehension.',
};

export default function AssessmentPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Free Reading Assessment
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Record your child reading a short passage and get instant AI-powered 
              feedback on fluency, pronunciation, and comprehension.
            </p>
          </div>
          
          {/* Assessment Form */}
          <AssessmentForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}
