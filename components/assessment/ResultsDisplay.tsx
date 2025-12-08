'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Calendar, 
  Share2,
  Download,
  Star
} from 'lucide-react';
import Link from 'next/link';
import { getScoreCategory, formatCurrency } from '@/lib/utils/helpers';

interface AssessmentResult {
  score: number;
  wpm: number;
  fluency: string;
  pronunciation: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  summary: string;
}

interface ResultsDisplayProps {
  assessmentId: string;
  childName: string;
  age: number;
  result: AssessmentResult;
  coachName?: string;
  coachSubdomain?: string;
}

export function ResultsDisplay({
  assessmentId,
  childName,
  age,
  result,
  coachName = 'Rucha Rai',
  coachSubdomain = 'rucha',
}: ResultsDisplayProps) {
  const scoreCategory = getScoreCategory(result.score);

  const scoreColors = {
    excellent: 'bg-green-100 text-green-700 border-green-300',
    good: 'bg-blue-100 text-blue-700 border-blue-300',
    fair: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    poor: 'bg-red-100 text-red-700 border-red-300',
  };

  const shareResults = async () => {
    const shareText = `${childName} completed a reading assessment on Yestoryd! Score: ${result.score}/10. Check it out!`;
    
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
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      alert('Link copied to clipboard!');
    }
  };

  return (
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
              <div className="text-5xl font-bold">{result.score}</div>
              <div className="text-sm">/10</div>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{result.wpm}</div>
              <div className="text-xs text-gray-500">Words/Min</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{result.fluency}</div>
              <div className="text-xs text-gray-500">Fluency</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{result.pronunciation}</div>
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
          <p className="text-gray-700 leading-relaxed">{result.summary}</p>
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
            {result.strengths.map((strength, index) => (
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
            {result.improvements.map((improvement, index) => (
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
            {result.nextSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="text-gray-700">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* CTA: Book Coaching Session */}
      <Card className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-3">
            Ready to Take the Next Step?
          </h3>
          <p className="mb-6 opacity-90">
            Book a FREE 30-minute coaching session with {coachName} to get personalized guidance for {childName}.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/book?assessmentId=${assessmentId}`}>
              <Button size="xl" variant="secondary" className="w-full sm:w-auto">
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
              <Badge variant="secondary" className="bg-white/20">Podcasts</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Coaching Packages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border-2 border-primary-200 rounded-lg bg-primary-50 relative">
              <Badge className="absolute -top-2 -right-2 bg-primary-600">Popular</Badge>
              <h4 className="font-semibold text-lg">6 Sessions Package</h4>
              <p className="text-3xl font-bold text-primary-600 my-2">
                {formatCurrency(5999)}
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ 6 one-hour coaching sessions</li>
                <li>✓ FREE eLearning access</li>
                <li>✓ FREE storytelling sessions</li>
                <li>✓ FREE physical classes</li>
                <li>✓ Progress tracking</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-lg">First Session</h4>
              <p className="text-3xl font-bold text-green-600 my-2">FREE</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ 30-minute consultation</li>
                <li>✓ Personalized assessment review</li>
                <li>✓ Custom learning plan</li>
                <li>✓ No obligation</li>
              </ul>
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
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Footer note */}
      <p className="text-center text-sm text-gray-500">
        Assessment ID: {assessmentId} • Results saved to your email
      </p>
    </div>
  );
}
