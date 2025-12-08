import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { AssessmentForm } from '@/components/assessment/AssessmentForm';

export const metadata = {
  title: 'Free Reading Assessment - Yestoryd',
  description: 'Take a free AI-powered reading assessment for your child. Get instant results and personalized recommendations.',
};

export default function AssessmentPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Free Reading Assessment
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Record your child reading a short passage and get instant AI-powered feedback 
              on fluency, pronunciation, and comprehension.
            </p>
          </div>
          
          <AssessmentForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}
