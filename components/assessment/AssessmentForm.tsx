'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User,
  Mail,
  Phone,
  Baby,
  Mic,
  Square,
  Loader2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  BookOpen,
  Sparkles,
  Globe,
  ChevronDown,
} from 'lucide-react';

// Country codes for top 30 countries
const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
];

// Reading passages by age group
const PASSAGES: Record<string, { title: string; text: string; wordCount: number }> = {
  '4-5': {
    title: 'The Red Ball',
    text: 'I have a red ball. The ball is big. I can kick the ball. The ball goes far. I run to get it. I like my ball.',
    wordCount: 30,
  },
  '6-7': {
    title: 'My Pet Dog',
    text: 'I have a pet dog named Max. He has soft brown fur and a wagging tail. Max likes to play fetch in the park. He runs very fast and brings the ball back to me. I love my dog Max.',
    wordCount: 45,
  },
  '8-9': {
    title: 'The Library Visit',
    text: 'Last Saturday, I visited the library with my mother. The library was quiet and filled with thousands of books. I found a fascinating book about dinosaurs and spent an hour reading about the mighty T-Rex. The librarian helped me find more books about prehistoric animals. I borrowed three books to read at home.',
    wordCount: 60,
  },
  '10-11': {
    title: 'The Science Fair',
    text: 'Our school organized an exciting science fair last month. Students from all grades participated with their innovative projects. My project was about solar energy and how it can power small devices. I built a miniature car that runs entirely on sunlight. The judges were impressed by the demonstration, and I won second place. This experience taught me that science can solve real-world problems.',
    wordCount: 75,
  },
  '12-15': {
    title: 'The Mountain Expedition',
    text: 'The expedition to Mount Everest base camp was the most challenging adventure of my life. Our team of twelve trekkers began the journey from Lukla, a small town in Nepal. The trail wound through ancient forests, across suspension bridges, and past traditional Sherpa villages. As we ascended higher, the air grew thinner, making each step more demanding. Despite the physical challenges, the breathtaking views of snow-capped peaks and the camaraderie among team members made every moment worthwhile.',
    wordCount: 90,
  },
};

export function AssessmentForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    parentName: '',
    parentEmail: '',
    countryCode: '+91',
    phoneNumber: '',
    childName: '',
    childAge: '',
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = COUNTRY_CODES.filter(
    (c) =>
      c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
  );

  const getAgeGroup = (age: number): string => {
    if (age <= 5) return '4-5';
    if (age <= 7) return '6-7';
    if (age <= 9) return '8-9';
    if (age <= 11) return '10-11';
    return '12-15';
  };

  const passage = formData.childAge
    ? PASSAGES[getAgeGroup(parseInt(formData.childAge))]
    : null;

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const selectCountry = (code: string) => {
    updateField('countryCode', code);
    setShowCountryDropdown(false);
    setCountrySearch('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Could not access microphone. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!audioBlob || !passage) return;

    setIsSubmitting(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const response = await fetch('/api/assessment/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64Audio,
            passage: passage.text,
            wordCount: passage.wordCount,
            childAge: parseInt(formData.childAge),
            childName: formData.childName,
            parentName: formData.parentName,
            parentEmail: formData.parentEmail,
            parentPhone: `${formData.countryCode}${formData.phoneNumber}`,
            recordingDuration: recordingTime,
          }),
        });

        const result = await response.json();

        if (result.success) {
          const params = new URLSearchParams({
            score: result.score?.toString() || '0',
            wpm: result.wpm?.toString() || '0',
            fluency: result.fluency || '',
            pronunciation: result.pronunciation || '',
            feedback: result.feedback || '',
            childName: formData.childName,
            childAge: formData.childAge,
            parentEmail: formData.parentEmail,
          });
          router.push(`/assessment/results/new?${params.toString()}`);
        } else {
          setError(result.error || 'Analysis failed. Please try again.');
          setIsSubmitting(false);
        }
      };
    } catch (err) {
      setError('Network error. Please try again.');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const isStep1Valid = formData.parentName && formData.parentEmail && formData.phoneNumber;
  const isStep2Valid = formData.childName && formData.childAge && parseInt(formData.childAge) >= 4 && parseInt(formData.childAge) <= 15;

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === formData.countryCode);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[
          { num: 1, label: 'Parent Info' },
          { num: 2, label: 'Child Info' },
          { num: 3, label: 'Recording' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step >= s.num
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
              </div>
              <span className="text-xs mt-1 text-gray-600">{s.label}</span>
            </div>
            {i < 2 && (
              <div className={`w-8 sm:w-16 h-1 mx-2 rounded ${step > s.num ? 'bg-[#3B82F6]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Parent Info */}
      {step === 1 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-[#3B82F6]" />
                Parent Information
              </CardTitle>
              <span className="flex items-center gap-1 text-xs bg-[#FBBF24]/20 text-[#FBBF24] px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Powered by AI
              </span>
            </div>
            <CardDescription className="text-gray-400">
              We'll send the assessment results to your email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="parentName" className="text-gray-200">Your Name *</Label>
              <Input
                id="parentName"
                value={formData.parentName}
                onChange={(e) => updateField('parentName', e.target.value)}
                placeholder="Enter your full name"
                className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#3B82F6]"
              />
            </div>
            
            <div>
              <Label htmlFor="parentEmail" className="text-gray-200">Email Address *</Label>
              <Input
                id="parentEmail"
                type="email"
                value={formData.parentEmail}
                onChange={(e) => updateField('parentEmail', e.target.value)}
                placeholder="your@email.com"
                className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#3B82F6]"
              />
              <p className="text-xs text-[#FBBF24] mt-1.5 flex items-center gap-1">
                🎓 A certificate will be sent to this email
              </p>
            </div>
            
            <div>
              <Label className="text-gray-200">Phone Number *</Label>
              <div className="flex gap-2 mt-1">
                {/* Country Code Selector */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="flex items-center gap-1 h-10 px-3 bg-gray-800 border border-gray-700 rounded-md text-white hover:bg-gray-700 transition-colors min-w-[100px]"
                  >
                    <span>{selectedCountry?.flag}</span>
                    <span className="text-sm">{formData.countryCode}</span>
                    <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
                  </button>
                  
                  {showCountryDropdown && (
                    <div className="absolute z-50 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-hidden">
                      <div className="p-2 border-b border-gray-700">
                        <Input
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredCountries.map((country) => (
                          <button
                            key={country.code}
                            onClick={() => selectCountry(country.code)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-gray-700 transition-colors text-sm"
                          >
                            <span>{country.flag}</span>
                            <span className="font-medium">{country.code}</span>
                            <span className="text-gray-400 text-xs">{country.country}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Phone Number Input */}
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#3B82F6]"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                💡 Type to search country code or use +91 for India
              </p>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!isStep1Valid}
              className="w-full mt-4 bg-[#FF2D92] hover:bg-[#E91E63] text-white"
              size="lg"
            >
              Continue to Child Info
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Child Info */}
      {step === 2 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <Baby className="w-5 h-5 text-[#3B82F6]" />
                Child Information
              </CardTitle>
              <span className="flex items-center gap-1 text-xs bg-[#FBBF24]/20 text-[#FBBF24] px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Powered by AI
              </span>
            </div>
            <CardDescription className="text-gray-400">
              Tell us about your child so we can personalize the assessment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="childName" className="text-gray-200">Child's Name *</Label>
              <Input
                id="childName"
                value={formData.childName}
                onChange={(e) => updateField('childName', e.target.value)}
                placeholder="Enter child's name"
                className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#3B82F6]"
              />
            </div>
            
            <div>
              <Label htmlFor="childAge" className="text-gray-200">Child's Age *</Label>
              <Input
                id="childAge"
                type="number"
                min="4"
                max="15"
                value={formData.childAge}
                onChange={(e) => updateField('childAge', e.target.value)}
                placeholder="Enter age (4-15)"
                className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#3B82F6]"
              />
              <p className="text-xs text-[#FBBF24] mt-1">Ages 4-15 supported</p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                size="lg"
                className="border-gray-700 text-gray-200 hover:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                className="flex-1 bg-[#FF2D92] hover:bg-[#E91E63] text-white"
                size="lg"
              >
                Continue to Recording
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Recording */}
      {step === 3 && passage && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-[#3B82F6]" />
                Reading Passage
              </CardTitle>
              <span className="flex items-center gap-1 text-xs bg-[#FBBF24]/20 text-[#FBBF24] px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Powered by AI
              </span>
            </div>
            <CardDescription className="text-gray-400">
              Ask {formData.childName} to read this passage aloud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Passage Card */}
            <div className="bg-white rounded-xl p-6 shadow-inner">
              <h3 className="text-lg font-bold text-gray-900 mb-3">{passage.title}</h3>
              <p className="text-gray-800 text-lg leading-relaxed">{passage.text}</p>
              <p className="text-sm text-gray-500 mt-3">{passage.wordCount} words</p>
            </div>

            {/* Recording Controls */}
            <div className="text-center">
              {!audioBlob ? (
                <>
                  {isRecording ? (
                    <div className="space-y-4">
                      <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                        <Mic className="w-10 h-10 text-red-600" />
                      </div>
                      <p className="text-2xl font-mono text-white">{formatTime(recordingTime)}</p>
                      <p className="text-[#FBBF24]">Recording... Click to stop when done</p>
                      <Button
                        onClick={stopRecording}
                        variant="destructive"
                        size="lg"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-24 h-24 mx-auto bg-[#3B82F6]/20 rounded-full flex items-center justify-center">
                        <Mic className="w-10 h-10 text-[#3B82F6]" />
                      </div>
                      <p className="text-gray-400">Click to start recording</p>
                      <Button
                        onClick={startRecording}
                        size="lg"
                        className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                      >
                        <Mic className="w-5 h-5 mr-2" />
                        Start Recording
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-green-400">Recording complete! ({formatTime(recordingTime)})</p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => setAudioBlob(null)}
                      variant="outline"
                      size="lg"
                      className="border-gray-700 text-gray-200 hover:bg-gray-800"
                    >
                      Record Again
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      size="lg"
                      className="bg-[#FF2D92] hover:bg-[#E91E63] text-white"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Get Results
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div className="pt-4 border-t border-gray-800">
              <Button
                onClick={() => setStep(2)}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Child Info
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
