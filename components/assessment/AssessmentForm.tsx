'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User,
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
  ChevronDown,
  Mail,
} from 'lucide-react';
import type { AssessmentPassage, SupportedCountryCode } from '@/types/settings';

// =============================================================================
// PROPS INTERFACE
// Passages and country codes should be passed from site_settings (no hardcoding)
// =============================================================================

interface AssessmentFormProps {
  passages: AssessmentPassage[];
  countryCodes?: SupportedCountryCode[];
}

// Default country codes (fallback only)
const DEFAULT_COUNTRY_CODES: SupportedCountryCode[] = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
];

// Cambridge English Level mapping (handles both numeric and string levels)
const CAMBRIDGE_LEVELS: Record<number | string, string> = {
  1: "Pre-A1 Starters",
  2: "A1 Movers",
  3: "A2 Flyers",
  4: "B1 Preliminary",
  5: "B2 First",
  "Pre-A1 Starters": "Pre-A1 Starters",
  "A1 Movers": "A1 Movers",
  "A2 Flyers": "A2 Flyers",
  "B1 Preliminary": "B1 Preliminary",
  "B2 First": "B2 First",
};

function getCambridgeLevel(level: number | string): string {
  return CAMBRIDGE_LEVELS[level] || String(level);
}

export function AssessmentForm({ passages, countryCodes }: AssessmentFormProps) {
  const COUNTRY_CODES = countryCodes || DEFAULT_COUNTRY_CODES;
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedPassage, setSelectedPassage] = useState<{ title: string; text: string; wordCount: number; level: string } | null>(null);

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
    (c) => c.country.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)
  );

  const getAgeGroup = (age: number): string => {
    if (age <= 5) return '4-5';
    if (age <= 7) return '6-7';
    if (age <= 9) return '8-9';
    return '10-12'; // Ages 10+ all use the same passage group (matches database)
  };

  const selectRandomPassage = () => {
    if (formData.childAge && passages.length > 0) {
      const ageGroup = getAgeGroup(parseInt(formData.childAge));
      // Filter passages by age group
      const filteredPassages = passages.filter(p => p.ageGroup === ageGroup);
      if (filteredPassages.length > 0) {
        const randomIndex = Math.floor(Math.random() * filteredPassages.length);
        const selected = filteredPassages[randomIndex];
        setSelectedPassage({
          title: selected.title,
          text: selected.text,
          wordCount: selected.wordCount,
          level: getCambridgeLevel(selected.level), // Normalize to Cambridge label
        });
      }
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const selectCountry = (code: string) => {
    updateField('countryCode', code);
    setShowCountryDropdown(false);
    setCountrySearch('');
  };

  const detectedMimeTypeRef = useRef<string>('audio/webm');

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      // Detect best supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      detectedMimeTypeRef.current = supportedMime || 'audio/webm';

      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      };
      if (supportedMime) {
        recorderOptions.mimeType = supportedMime;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: detectedMimeTypeRef.current });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!audioBlob || !selectedPassage) return;
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
            passage: selectedPassage.text,
            wordCount: selectedPassage.wordCount,
            childAge: parseInt(formData.childAge),
            childName: formData.childName,
            parentName: formData.parentName,
            parentEmail: formData.parentEmail,
            parentPhone: `${formData.countryCode}${formData.phoneNumber}`,
            recordingDuration: recordingTime,
            mimeType: detectedMimeTypeRef.current,
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
            parentPhone: `${formData.countryCode}${formData.phoneNumber}`,
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const isPhoneValid = formData.phoneNumber.length >= 7 && formData.phoneNumber.length <= 15;
  const isEmailValid = formData.parentEmail.includes('@') && formData.parentEmail.includes('.');
  const isFormValid = formData.parentName && isEmailValid && isPhoneValid && formData.childName && formData.childAge && parseInt(formData.childAge) >= 4 && parseInt(formData.childAge) <= 12;

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === formData.countryCode);

  const goToStep2 = () => {
    selectRandomPassage();
    setStep(2);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
        {[
          { num: 1, label: 'Details' },
          { num: 2, label: 'Record' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= s.num ? 'bg-pink-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
              </div>
              <span className="text-xs sm:text-sm mt-1 text-gray-400">{s.label}</span>
            </div>
            {i < 1 && <div className={`w-12 sm:w-20 h-1 mx-2 sm:mx-4 rounded ${step > s.num ? 'bg-pink-500' : 'bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Combined Parent + Child Info */}
      {step === 1 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-xl">
                <BookOpen className="w-6 h-6 text-pink-400" />
                Free Reading Assessment
              </CardTitle>
              <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                <Sparkles className="w-3 h-3" /> AI Powered
              </span>
            </div>
            <CardDescription className="text-gray-400">Fill in details to start the assessment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Parent Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-400 font-medium">
                <User className="w-4 h-4" />
                <span>Parent Information</span>
              </div>
              
              <div>
                <Label className="text-gray-200 text-sm">Your Name *</Label>
                <Input
                  value={formData.parentName}
                  onChange={(e) => updateField('parentName', e.target.value)}
                  placeholder="Full name"
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <Label className="text-gray-200 text-sm">Email *</Label>
                <Input
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => updateField('parentEmail', e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <Label className="text-gray-200 text-sm">Phone *</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="flex items-center gap-1 h-10 px-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm min-w-[90px]"
                    >
                      <span>{selectedCountry?.flag}</span>
                      <span>{formData.countryCode}</span>
                      <ChevronDown className="w-3 h-3 ml-auto text-gray-400" />
                    </button>
                    
                    {showCountryDropdown && (
                      <div className="absolute z-50 mt-1 w-56 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-hidden">
                        <div className="p-2 border-b border-gray-600">
                          <Input
                            placeholder="Search..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="bg-gray-800 border-gray-600 text-white h-8 text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-36 overflow-y-auto">
                          {filteredCountries.map((country) => (
                            <button
                              key={country.code}
                              onClick={() => selectCountry(country.code)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-gray-600 text-sm"
                            >
                              <span>{country.flag}</span>
                              <span>{country.code}</span>
                              <span className="text-gray-400 text-xs">{country.country}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => updateField('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 15))}
                    placeholder="Phone number"
                    className="flex-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 my-2"></div>

            {/* Child Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 font-medium">
                <Baby className="w-4 h-4" />
                <span>Child Information</span>
              </div>
              
              <div>
                <Label className="text-gray-200 text-sm">Child&apos;s Name *</Label>
                <Input
                  value={formData.childName}
                  onChange={(e) => updateField('childName', e.target.value)}
                  placeholder="Child's name"
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <Label className="text-gray-200 text-sm">Child&apos;s Age *</Label>
                <Input
                  type="number"
                  min="4"
                  max="12"
                  value={formData.childAge}
                  onChange={(e) => updateField('childAge', e.target.value)}
                  placeholder="Age (4-12 years)"
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">📚 Passage difficulty adjusts based on age</p>
              </div>
            </div>

            {/* Certificate Email Notice */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
              <Mail className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-yellow-400 font-medium">Certificate will be emailed</p>
                <p className="text-gray-400 text-xs mt-0.5">Check your spam/junk folder if not in inbox</p>
              </div>
            </div>

            <Button onClick={goToStep2} disabled={!isFormValid} className="w-full bg-pink-500 hover:bg-pink-600 text-white text-lg py-6">
              Continue to Recording <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Recording */}
      {step === 2 && selectedPassage && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Reading Passage
              </CardTitle>
              <span className="text-xs text-gray-500">{selectedPassage.level}</span>
            </div>
            <CardDescription className="text-gray-400 text-sm">Ask {formData.childName} to read aloud clearly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Passage */}
            <div className="bg-white rounded-xl p-4 sm:p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{selectedPassage.title}</h3>
              <p className="text-gray-800 text-base leading-relaxed">{selectedPassage.text}</p>
              <p className="text-xs text-gray-500 mt-3">{selectedPassage.wordCount} words</p>
            </div>

            {/* Recording Controls */}
            <div className="text-center py-4">
              {!audioBlob ? (
                <>
                  {isRecording ? (
                    <div className="space-y-4">
                      {/* Pulsating Mic */}
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-25"></div>
                        <div className="absolute inset-2 bg-red-500 rounded-full animate-pulse opacity-40"></div>
                        <div className="relative w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
                          <Mic className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <p className="text-3xl font-mono text-white">{formatTime(recordingTime)}</p>
                      <p className="text-yellow-400 text-sm">🎤 Recording... Tap to stop</p>
                      <Button onClick={stopRecording} variant="danger" size="lg" className="bg-red-600 hover:bg-red-700 px-8">
                        <Square className="w-4 h-4 mr-2" /> Stop Recording
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-24 h-24 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center border-2 border-blue-500/50">
                        <Mic className="w-10 h-10 text-blue-400" />
                      </div>
                      <p className="text-gray-400">Tap to start recording</p>
                      <Button onClick={startRecording} size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-8">
                        <Mic className="w-5 h-5 mr-2" /> Start Recording
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500/50">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </div>
                  <p className="text-green-400 font-medium">Recording complete! ({formatTime(recordingTime)})</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => { setAudioBlob(null); setRecordingTime(0); }} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      Record Again
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-pink-500 hover:bg-pink-600 text-white px-6">
                      {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <>Get Results <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <Button onClick={() => setStep(1)} variant="ghost" className="text-gray-400 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Details
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
