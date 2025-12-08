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
} from 'lucide-react';

// Country codes
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
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+968', country: 'Oman', flag: '🇴🇲' },
];

// 3 passages per age group (50-130 words, increasing complexity)
const PASSAGES: Record<string, Array<{ title: string; text: string; wordCount: number }>> = {
  '4-5': [
    {
      title: 'My Red Ball',
      text: 'I have a red ball. The ball is big and round. I kick the ball. It goes far away. I run fast to get it. My dog runs with me. We play all day. I love my ball.',
      wordCount: 50,
    },
    {
      title: 'The Cat',
      text: 'I see a cat. The cat is small and soft. It has white fur. The cat likes to sleep on my bed. It purrs when I pet it. The cat drinks milk from a bowl. I love my cat very much. We are best friends.',
      wordCount: 55,
    },
    {
      title: 'At the Park',
      text: 'I go to the park with Mom. The park has swings and slides. I play on the swing first. Then I go down the big slide. I see birds in the trees. A butterfly flies by me. The sun is warm and bright. I have so much fun at the park today.',
      wordCount: 60,
    },
  ],
  '6-7': [
    {
      title: 'My Pet Dog Max',
      text: 'I have a pet dog named Max. He has soft brown fur and a wagging tail. Max likes to play fetch in the park every morning. He runs very fast and always brings the ball back to me. At night, Max sleeps near my bed. He is my best friend and I love him very much.',
      wordCount: 65,
    },
    {
      title: 'The Birthday Party',
      text: 'Today is my birthday and I am very happy. My mom made a big chocolate cake with candles on top. All my friends came to my house for the party. We played games and danced to music. I got many wonderful gifts. The best gift was a new bicycle from my parents. It was the best birthday ever.',
      wordCount: 70,
    },
    {
      title: 'A Day at School',
      text: 'I wake up early every morning for school. My mom makes breakfast and I eat quickly. The school bus comes at eight o clock. At school, I learn reading, writing and math. My favorite subject is art because I love to draw and paint. During lunch, I sit with my friends. After school, I do my homework and then play outside.',
      wordCount: 75,
    },
  ],
  '8-9': [
    {
      title: 'The Library Visit',
      text: 'Last Saturday, I visited the library with my mother. The library was quiet and filled with thousands of books on tall wooden shelves. I found a fascinating book about dinosaurs and spent an hour reading about the mighty T-Rex and other prehistoric creatures. The friendly librarian helped me find more books about ancient animals. I borrowed three interesting books to read at home during the week.',
      wordCount: 80,
    },
    {
      title: 'My Garden Adventure',
      text: 'My grandmother has a beautiful garden behind her house. Every weekend, I help her plant flowers and vegetables. We grow tomatoes, carrots, and sunflowers together. Last month, we planted some mango seeds and watched them sprout. Grandmother taught me how to water the plants properly and remove the weeds. Working in the garden makes me feel peaceful and happy. I have learned that plants need sunlight, water, and love to grow strong.',
      wordCount: 90,
    },
    {
      title: 'The Rainy Day',
      text: 'Yesterday, dark clouds covered the sky and it started raining heavily. The thunder was loud and lightning flashed across the sky. I watched the raindrops racing down my window glass. My little sister was scared, so I told her stories to make her feel better. When the rain stopped, we went outside and jumped in the puddles. We saw a beautiful rainbow stretching across the sky with all its wonderful colors. It was a magical afternoon.',
      wordCount: 95,
    },
  ],
  '10-11': [
    {
      title: 'The Science Fair Project',
      text: 'Our school organized an exciting science fair last month where students from all grades participated with their innovative projects. My project was about solar energy and how it can power small electronic devices. I built a miniature car that runs entirely on sunlight using solar panels. The judges were quite impressed by my demonstration and asked many questions about renewable energy. I won second place and received a certificate. This wonderful experience taught me that science can solve real-world problems and help protect our environment.',
      wordCount: 100,
    },
    {
      title: 'The Football Match',
      text: 'Last Sunday, our school football team played an important match against our rival school. The stadium was packed with cheering students and proud parents. Our team practiced hard for many weeks before this big game. In the first half, the other team scored one goal and we were worried. During halftime, our coach gave us an inspiring speech about teamwork and determination. In the second half, we played with more energy and scored two goals. We won the match and celebrated together. It taught me that hard work and never giving up leads to success.',
      wordCount: 110,
    },
    {
      title: 'Visiting the Museum',
      text: 'During our summer vacation, my family visited the National Museum in Delhi. The museum was enormous with countless fascinating exhibits spread across three floors. We saw ancient artifacts from the Indus Valley civilization that were thousands of years old. The guide explained how people lived in those times without modern technology. My favorite section displayed armor and weapons used by brave warriors in medieval India. We also saw beautiful paintings by famous artists and sculptures carved from marble. I took many photographs to show my classmates. This educational trip made history come alive for me.',
      wordCount: 115,
    },
  ],
  '12-15': [
    {
      title: 'The Mountain Expedition',
      text: 'The expedition to the Himalayan foothills was the most challenging adventure of my life so far. Our group of twelve trekkers began the journey from a small village in Uttarakhand early in the morning. The trail wound through ancient pine forests, across wooden suspension bridges, and past traditional mountain villages where locals welcomed us warmly. As we ascended higher along the steep paths, the air grew thinner and colder, making each step more demanding than the last. Despite the physical challenges and aching muscles, the breathtaking views of snow-capped peaks and the strong camaraderie among team members made every difficult moment completely worthwhile.',
      wordCount: 120,
    },
    {
      title: 'The Power of Books',
      text: 'Books have been my faithful companions since I learned to read at the age of five. Through the pages of countless novels, I have traveled to distant galaxies, explored ancient civilizations, and lived through historical events. Reading has expanded my vocabulary and improved my understanding of complex ideas significantly. My favorite genre is science fiction because it challenges me to imagine possibilities beyond our current reality. Last year, I started a book club at school where we discuss different literary works and share our interpretations. Books have taught me empathy by allowing me to experience life through different perspectives. I believe that a person who reads lives a thousand different lives.',
      wordCount: 125,
    },
    {
      title: 'Climate Change and Our Responsibility',
      text: 'Climate change has become one of the most pressing challenges facing humanity in the twenty-first century. Scientists around the world have documented rising global temperatures, melting polar ice caps, and increasingly severe weather patterns that threaten ecosystems everywhere. As young citizens of this planet, we have both the responsibility and the power to make meaningful changes in our daily lives. Simple actions like reducing plastic usage, conserving electricity, planting trees, and choosing sustainable transportation options can collectively make an enormous difference. At my school, we started an environmental club that organizes awareness campaigns and tree plantation drives in our community. I firmly believe that if every individual commits to protecting our environment, we can create a sustainable future for generations to come.',
      wordCount: 130,
    },
  ],
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
  const [selectedPassage, setSelectedPassage] = useState<{ title: string; text: string; wordCount: number } | null>(null);

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
    if (age <= 11) return '10-11';
    return '12-15';
  };

  // Select random passage when moving to step 3
  const selectRandomPassage = () => {
    if (formData.childAge) {
      const ageGroup = getAgeGroup(parseInt(formData.childAge));
      const passages = PASSAGES[ageGroup];
      const randomIndex = Math.floor(Math.random() * passages.length);
      setSelectedPassage(passages[randomIndex]);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Validation: 7-15 digits for phone
  const isPhoneValid = formData.phoneNumber.length >= 7 && formData.phoneNumber.length <= 15;
  const isStep1Valid = formData.parentName && formData.parentEmail && isPhoneValid;
  const isStep2Valid = formData.childName && formData.childAge && parseInt(formData.childAge) >= 4 && parseInt(formData.childAge) <= 15;

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === formData.countryCode);

  const goToStep3 = () => {
    selectRandomPassage();
    setStep(3);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
        {[
          { num: 1, label: 'Parent' },
          { num: 2, label: 'Child' },
          { num: 3, label: 'Record' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= s.num ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
              </div>
              <span className="text-[10px] sm:text-xs mt-1 text-gray-400">{s.label}</span>
            </div>
            {i < 2 && <div className={`w-6 sm:w-12 h-0.5 mx-1 sm:mx-2 rounded ${step > s.num ? 'bg-blue-500' : 'bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Parent Info */}
      {step === 1 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <User className="w-5 h-5 text-blue-400" />
                Parent Information
              </CardTitle>
              <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full whitespace-nowrap">
                <Sparkles className="w-3 h-3" /> AI Powered
              </span>
            </div>
            <CardDescription className="text-gray-400 text-sm">Results will be sent to your email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-[11px] text-yellow-400 mt-1">🎓 Certificate will be sent here</p>
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
              <p className="text-[11px] text-gray-500 mt-1">💡 7-15 digits allowed</p>
            </div>

            <Button onClick={() => setStep(2)} disabled={!isStep1Valid} className="w-full bg-pink-500 hover:bg-pink-600 text-white" size="lg">
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Child Info */}
      {step === 2 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <Baby className="w-5 h-5 text-blue-400" />
                Child Information
              </CardTitle>
              <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full whitespace-nowrap">
                <Sparkles className="w-3 h-3" /> AI Powered
              </span>
            </div>
            <CardDescription className="text-gray-400 text-sm">Personalized assessment based on age</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                max="15"
                value={formData.childAge}
                onChange={(e) => updateField('childAge', e.target.value)}
                placeholder="Age (4-15)"
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
              />
              <p className="text-[11px] text-yellow-400 mt-1">📚 Ages 4-15 supported</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setStep(1)} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={goToStep3} disabled={!isStep2Valid} className="flex-1 bg-pink-500 hover:bg-pink-600 text-white">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Recording */}
      {step === 3 && selectedPassage && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Reading Passage
              </CardTitle>
              <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full whitespace-nowrap">
                <Sparkles className="w-3 h-3" /> AI Powered
              </span>
            </div>
            <CardDescription className="text-gray-400 text-sm">Ask {formData.childName} to read aloud</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Passage */}
            <div className="bg-white rounded-xl p-4 sm:p-5">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{selectedPassage.title}</h3>
              <p className="text-gray-800 text-sm sm:text-base leading-relaxed">{selectedPassage.text}</p>
              <p className="text-xs text-gray-500 mt-2">{selectedPassage.wordCount} words</p>
            </div>

            {/* Recording Controls */}
            <div className="text-center py-4">
              {!audioBlob ? (
                <>
                  {isRecording ? (
                    <div className="space-y-3">
                      {/* Pulsating Mic */}
                      <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-25"></div>
                        <div className="absolute inset-2 bg-red-500 rounded-full animate-pulse opacity-40"></div>
                        <div className="relative w-20 h-20 bg-red-500 rounded-full flex items-center justify-center">
                          <Mic className="w-8 h-8 text-white animate-pulse" />
                        </div>
                      </div>
                      <p className="text-2xl font-mono text-white">{formatTime(recordingTime)}</p>
                      <p className="text-yellow-400 text-sm">Recording... Tap to stop</p>
                      <Button onClick={stopRecording} variant="destructive" size="lg" className="bg-red-600 hover:bg-red-700">
                        <Square className="w-4 h-4 mr-2" /> Stop
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-20 h-20 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Mic className="w-8 h-8 text-blue-400" />
                      </div>
                      <p className="text-gray-400 text-sm">Tap to start recording</p>
                      <Button onClick={startRecording} size="lg" className="bg-blue-500 hover:bg-blue-600 text-white">
                        <Mic className="w-4 h-4 mr-2" /> Start Recording
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-green-400 text-sm">Recording complete ({formatTime(recordingTime)})</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => setAudioBlob(null)} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      Record Again
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-pink-500 hover:bg-pink-600 text-white">
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

            <Button onClick={() => setStep(2)} variant="ghost" className="text-gray-400 hover:text-white text-sm">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
