'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AudioRecorder } from './AudioRecorder';
import { READING_PASSAGES } from '@/lib/utils/constants';
import { ChevronRight, ChevronLeft, User, Baby, Mic, Loader2 } from 'lucide-react';

interface AssessmentFormProps {
  coachSubdomain?: string;
  coachName?: string;
}

export function AssessmentForm({ coachSubdomain, coachName }: AssessmentFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    childName: '',
    age: 6,
  });

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Get random passage for the age
  const passage = useMemo(() => {
    const agePassages = READING_PASSAGES[formData.age] || READING_PASSAGES[6];
    const randomIndex = Math.floor(Math.random() * agePassages.length);
    return agePassages[randomIndex];
  }, [formData.age]);

  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isStep1Valid = formData.parentName && formData.parentEmail && formData.parentPhone;
  const isStep2Valid = formData.childName && formData.age >= 4 && formData.age <= 15;
  const isStep3Valid = audioBlob !== null;

  const handleSubmit = async () => {
    if (!audioBlob) {
      setError('Please record your child reading the passage');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submitData = new FormData();
      submitData.append('parentName', formData.parentName);
      submitData.append('parentEmail', formData.parentEmail);
      submitData.append('parentPhone', formData.parentPhone);
      submitData.append('childName', formData.childName);
      submitData.append('age', formData.age.toString());
      submitData.append('passage', passage);
      submitData.append('audio', audioBlob, 'recording.webm');
      
      if (coachSubdomain) {
        submitData.append('coachSubdomain', coachSubdomain);
      }

      const response = await fetch('/api/assessment/analyze', {
        method: 'POST',
        body: submitData,
      });

      const result = await response.json();

      if (result.success) {
        // Build URL with all the results data
        const params = new URLSearchParams({
          score: result.analysis.score.toString(),
          wpm: result.analysis.wpm.toString(),
          fluency: result.analysis.fluency,
          pronunciation: result.analysis.pronunciation,
          childName: formData.childName,
          age: formData.age.toString(),
          strengths: encodeURIComponent(JSON.stringify(result.analysis.strengths)),
          improvements: encodeURIComponent(JSON.stringify(result.analysis.improvements)),
          nextSteps: encodeURIComponent(JSON.stringify(result.analysis.nextSteps)),
          summary: encodeURIComponent(result.analysis.summary),
        });
        
        router.push(`/assessment/results/${result.assessmentId}?${params.toString()}`);
      } else {
        setError(result.error || 'Failed to analyze assessment. Please try again.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= stepNum
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {stepNum}
              </div>
              {stepNum < 3 && (
                <div
                  className={`w-12 h-1 ${
                    step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600 px-2">
          <span>Parent Info</span>
          <span>Child Info</span>
          <span>Recording</span>
        </div>
      </div>

      {/* Coach branding */}
      {coachName && (
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-500">
            Assessment for <span className="font-semibold text-blue-600">{coachName}</span>
          </p>
        </div>
      )}

      {/* Step 1: Parent Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-6 h-6" />
              Parent Information
            </CardTitle>
            <CardDescription>
              We'll send the assessment results to this contact
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="parentName">Your Name *</Label>
              <Input
                id="parentName"
                value={formData.parentName}
                onChange={(e) => updateField('parentName', e.target.value)}
                placeholder="Enter your full name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="parentEmail">Email Address *</Label>
              <Input
                id="parentEmail"
                type="email"
                value={formData.parentEmail}
                onChange={(e) => updateField('parentEmail', e.target.value)}
                placeholder="your@email.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="parentPhone">Phone Number *</Label>
              <Input
                id="parentPhone"
                type="tel"
                value={formData.parentPhone}
                onChange={(e) => updateField('parentPhone', e.target.value)}
                placeholder="+91 9876543210"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Include country code for WhatsApp updates
              </p>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!isStep1Valid}
              className="w-full mt-4"
              size="lg"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Child Information */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Baby className="w-6 h-6" />
              Child Information
            </CardTitle>
            <CardDescription>
              Tell us about your child so we can personalize the assessment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="childName">Child's Name *</Label>
              <Input
                id="childName"
                value={formData.childName}
                onChange={(e) => updateField('childName', e.target.value)}
                placeholder="Enter your child's name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="age">Child's Age *</Label>
              <Input
                id="age"
                type="number"
                min="4"
                max="15"
                value={formData.age}
                onChange={(e) => updateField('age', parseInt(e.target.value) || 6)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ages 4-15 supported
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                size="lg"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                className="flex-1"
                size="lg"
              >
                Continue to Recording
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Recording */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-6 h-6" />
              Reading Assessment
            </CardTitle>
            <CardDescription>
              Have {formData.childName} read the passage below aloud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Passage to read */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">
                Passage for Age {formData.age}:
              </h4>
              <p className="text-lg leading-relaxed text-gray-800">
                {passage}
              </p>
            </div>

            {/* Audio recorder */}
            <div className="py-4">
              <AudioRecorder onRecordingComplete={setAudioBlob} />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                size="lg"
                disabled={isSubmitting}
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isStep3Valid || isSubmitting}
                className="flex-1"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Submit Assessment
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
