'use client';

import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Calendar, 
  Share2,
  Star
} from 'lucide-react';

export default function ResultsPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  
  // Get results from URL params (passed from assessment form)
  const score = parseInt(searchParams.get('score') || '7');
  const wpm = parseInt(searchParams.get('wpm') || '60');
  const fluency = searchParams.get('fluency') || 'Good';
  const pronunciation = searchParams.get('pronunciation') || 'Good';
  const childName = searchParams.get('childName') || 'Your Child';
  const age = searchParams.get('age') || '8';

  // Parse arrays from URL
  let strengths = ['Clear pronunciation', 'Good effort', 'Completed the passage'];
  let improvements = ['Practice daily reading', 'Work on fluency', 'Build vocabulary'];
  let nextSteps = ['Read aloud 15 minutes daily', 'Practice with age-appropriate books', 'Book a coaching session'];
  let summary = `${childName} showed great effort in this reading assessment! With regular practice, reading skills will continue to improve.`;

  try {
    const strengthsParam = searchParams.get('strengths');
    const improvementsParam = searchParams.get('improvements');
    const nextStepsParam = searchParams.get('nextSteps');
    const summaryParam = searchParams.get('summary');
    
    if (strengthsParam) strengths = JSON.parse(decodeURIComponent(strengthsParam));
    if (improvementsParam) improvements = JSON.parse(decodeURIComponent(improvementsParam));
    if (nextStepsParam) nextSteps = JSON.parse(decodeURIComponent(nextStepsParam));
    if (summaryParam) summary = decodeURIComponent(summaryParam);
  } catch (e) {
    console.log('Using default values');
  }

  const getScoreCategory = (score: number) => {
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'fair';
    return 'poor';
  };

  const scoreCategory = getScoreCategory(score);

  const scoreColors: Record<string, string> = {
    excellent: 'bg-green-100 text-green-700 border-green-300',
    good: 'bg-blue-100 text-blue-700 border-blue-300',
    fair: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    poor: 'bg-red-100 text-red-700 border-red-300',
  };

  const shareResults = async () => {
    const shareText = `${childName} completed a reading assessment on Yestoryd! Score: ${score}/10`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Yestoryd Reading Assessment',
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto p-4 space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Assessment Complete! 🎉
            </h1>
            <p className="text-gray-600">
              Great job, {childName}! Here are your results.
            </p>
          </div>

          {/* Score Card */}
          <Card className="overflow-hidden">
            <div className={`p-6 ${scoreColors[scoreCategory]} border-b`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Reading Score</h2>
                  <p className="text-sm opacity-75">Age {age} assessment</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold">{score}</div>
                  <div className="text-sm">/10</div>
                </div>
              </div>
            </div>
            
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{wpm}</div>
                  <div className="text-xs text-gray-500">Words/Min</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900">{fluency}</div>
                  <div className="text-xs text-gray-500">Fluency</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900">{pronunciation}</div>
                  <div className="text-xs text-gray-500">Pronunciation</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{summary}</p>
            </CardContent>
          </Card>

          {/* Strengths */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Areas for Improvement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 text-amber-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{improvement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* CTA: Book Coaching Session */}
          <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-3">
                Ready to Take the Next Step?
              </h3>
              <p className="mb-6 opacity-90">
                Book a FREE 30-minute coaching session with Rucha Rai to get personalized guidance for {childName}.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/book">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    <Calendar className="w-5 h-5 mr-2" />
                    Book Free Session
                  </Button>
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-white/20">
                <p className="text-sm opacity-75 mb-2">With coaching, you also get FREE access to:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="secondary" className="bg-white/20">eLearning Library</Badge>
                  <Badge variant="secondary" className="bg-white/20">Storytelling Sessions</Badge>
                  <Badge variant="secondary" className="bg-white/20">Physical Classes</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center py-4">
            <Button variant="outline" onClick={shareResults}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Results
            </Button>
            <Link href="/assessment">
              <Button variant="outline">
                Take Another Assessment
              </Button>
            </Link>
          </div>

          {/* Footer note */}
          <p className="text-center text-sm text-gray-500">
            Assessment ID: {params.id}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
