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

// 5 passages per age group (Oxford/Cambridge level, strictly 50-130 words)
const PASSAGES: Record<string, Array<{ title: string; text: string; wordCount: number; level: string }>> = {
  '4-5': [
    {
      title: 'My Red Ball',
      text: 'I have a red ball. The ball is big and round. I kick the ball. It goes far away. I run fast to get it. My dog runs with me. We play all day. The sun is hot. I am very happy.',
      wordCount: 42,
      level: 'Pre-A1 Starters',
    },
    {
      title: 'The Little Cat',
      text: 'I see a small cat. The cat has soft white fur. It has big green eyes. The cat sleeps on my bed. It likes warm milk. I love my cat. We play with a red ball. The cat is my best friend.',
      wordCount: 42,
      level: 'Pre-A1 Starters',
    },
    {
      title: 'At the Park',
      text: 'I go to the park with Mum. The park has big trees and green grass. I play on the swing. It goes up and down. I see a yellow bird in a tree. A butterfly flies near me. I run and jump. It is a fun day at the park.',
      wordCount: 50,
      level: 'Pre-A1 Starters',
    },
    {
      title: 'My Family',
      text: 'I live in a small house. My dad is tall. My mum has long hair. I have a baby sister. She is two years old. We eat dinner together. Dad makes rice and fish. After dinner, we watch TV. I love my family very much. They make me happy every day.',
      wordCount: 51,
      level: 'Pre-A1 Starters',
    },
    {
      title: 'A Sunny Morning',
      text: 'I wake up early in the morning. The sun is bright in the sky. Birds sing in the garden. I brush my teeth and wash my face. Mum gives me toast and milk for breakfast. I put on my blue shirt and brown shoes. Dad takes me to school in his car. I wave goodbye and walk to my class. My teacher smiles at me. It is a good day.',
      wordCount: 70,
      level: 'Pre-A1 Starters',
    },
  ],
  '6-7': [
    {
      title: 'My Pet Dog',
      text: 'I have a pet dog named Max. He has soft brown fur and a long tail. Max likes to play in the garden every morning. He runs very fast and catches the ball. At night, Max sleeps near my bed. He is my best friend.',
      wordCount: 45,
      level: 'A1 Movers',
    },
    {
      title: 'The Birthday Party',
      text: 'Today is my birthday. I am seven years old. Mum made a big chocolate cake with candles. My friends came to my house. We played games and danced to music. I got many nice gifts. The best gift was a new bicycle from Dad. It was the best birthday.',
      wordCount: 49,
      level: 'A1 Movers',
    },
    {
      title: 'Going to School',
      text: 'I wake up at seven every morning. Mum makes breakfast for me. I eat bread and drink milk. The school bus comes at eight. At school, I learn reading and maths. My favourite lesson is art. I like to paint pictures of animals. After school, I play with my friends. Then I go home and do my homework.',
      wordCount: 58,
      level: 'A1 Movers',
    },
    {
      title: 'The Helpful Robot',
      text: 'Sam got a new robot for his birthday. The robot was small and silver. It could walk and talk. Every morning, the robot helped Sam find his books. One day, Sam lost his toy car. The robot looked everywhere. It found the car under the bed. Sam was very happy. He gave the robot a big hug.',
      wordCount: 57,
      level: 'A1 Movers',
    },
    {
      title: 'The Magic Garden',
      text: 'Behind my grandmother\'s house, there is a beautiful garden. Colourful flowers grow there all year. Butterflies fly from plant to plant. In the middle, there is an old apple tree. Grandmother says if you make a kind wish near the flowers, it might come true. One day, I wished for my sick friend to get better. The next week, she came back to school. I think the garden really is magic.',
      wordCount: 71,
      level: 'A1 Movers',
    },
  ],
  '8-9': [
    {
      title: 'The Library Visit',
      text: 'Last Saturday, I went to the library with my mother. The library was quiet and full of books. I found a book about dinosaurs and read for one hour. The librarian helped me find more books about animals. I borrowed three books to read at home.',
      wordCount: 46,
      level: 'A2 Flyers',
    },
    {
      title: 'My Grandmother\'s Garden',
      text: 'My grandmother has a vegetable garden behind her house. Every weekend, I help her plant flowers and vegetables. We grow tomatoes, carrots and sunflowers. Last month, we planted mango seeds and watched them grow. Grandmother taught me how to water the plants. Working in the garden makes me feel happy and peaceful.',
      wordCount: 52,
      level: 'A2 Flyers',
    },
    {
      title: 'The Thunderstorm',
      text: 'Yesterday, dark clouds covered the sky and it started raining heavily. Thunder made loud sounds and lightning flashed across the sky. I sat by the window and watched the raindrops. My little sister was scared, so I told her stories to make her feel better. When the rain stopped, we went outside and jumped in the puddles. We saw a beautiful rainbow with many colours.',
      wordCount: 65,
      level: 'A2 Flyers',
    },
    {
      title: 'The School Trip',
      text: 'Our class went on a trip to the zoo last week. We travelled by bus for one hour. At the zoo, we saw many animals like lions, elephants and monkeys. The monkeys were very funny. They jumped from tree to tree. We ate our lunch near the lake and watched the ducks swim. Our teacher took many photos. It was the best school trip ever.',
      wordCount: 65,
      level: 'A2 Flyers',
    },
    {
      title: 'The Science Museum',
      text: 'During the holidays, my father took me to the Science Museum. The building had five floors with many interesting things to see. My favourite part was about space. I saw real spacesuits and models of rockets. I learned how planets move around the sun. There was a special room where I could feel what it is like to walk on the moon. I pressed buttons and did experiments all day. It was amazing.',
      wordCount: 73,
      level: 'A2 Flyers',
    },
  ],
  '10-11': [
    {
      title: 'The Science Fair',
      text: 'Our school had a science fair last month. Students from all classes showed their projects. My project was about solar energy. I made a small car that runs on sunlight. The judges liked my work and asked many questions. I won second place and got a certificate. This experience taught me that science can help solve problems.',
      wordCount: 57,
      level: 'B1 Preliminary',
    },
    {
      title: 'The Football Match',
      text: 'Last Sunday, our school team played an important football match. The stadium was full of students and parents. Our team had practised for many weeks. In the first half, the other team scored one goal. During the break, our coach told us to work together. In the second half, we scored two goals. We won the match and celebrated together.',
      wordCount: 60,
      level: 'B1 Preliminary',
    },
    {
      title: 'The Mountain Trek',
      text: 'During the October holidays, my family went on a trek to a hill station. We started early when the air was cool. The path went through forests with tall trees and colourful birds. As we climbed higher, the air became colder. My brother found it difficult, but we helped him. After four hours, we reached the top. The view was beautiful with green valleys below. We ate lunch together and felt proud of ourselves.',
      wordCount: 74,
      level: 'B1 Preliminary',
    },
    {
      title: 'The Robotics Club',
      text: 'This year, I joined my school\'s robotics club. We meet every Wednesday afternoon. Our teacher Mr Sharma teaches us to build and programme robots. At first, I made many mistakes and my robot did not work. But I kept trying and my teammates helped me. Last month, we entered a competition. Our robot could move through a maze and pick up objects. We did not win first place, but the judges liked our ideas. I learned that working together and not giving up are important.',
      wordCount: 85,
      level: 'B1 Preliminary',
    },
    {
      title: 'Saving Our Environment',
      text: 'My friends and I started a campaign to reduce plastic in our neighbourhood. We made posters explaining why plastic is harmful to animals and the earth. Every weekend, we visited houses and gave people cloth bags instead of plastic. At first, many people did not listen. But we did not stop. Slowly, more people started using less plastic. The local newspaper wrote about us. I believe young people can make a difference when they work together.',
      wordCount: 76,
      level: 'B1 Preliminary',
    },
  ],
  '12-15': [
    {
      title: 'The Himalayan Trek',
      text: 'The trek to the Himalayan foothills was the most challenging adventure of my life. Our group started from a small village at dawn. The path went through pine forests, across old bridges, and past mountain villages. As we climbed higher, the air became thin and cold. Despite tired muscles, the views of snow-covered peaks made every step worthwhile.',
      wordCount: 58,
      level: 'B2 First',
    },
    {
      title: 'The Power of Books',
      text: 'Books have been my companions since I learned to read at five. Through stories, I have travelled to distant places, met interesting characters, and learned about different times in history. Reading has improved my vocabulary and helped me understand complex ideas. Last year, I started a book club at school where we discuss different stories. I believe that reading allows us to live many lives through the characters we meet.',
      wordCount: 70,
      level: 'B2 First',
    },
    {
      title: 'Climate Change',
      text: 'Climate change is one of the biggest challenges facing our world today. Scientists have found that temperatures are rising, ice is melting, and weather patterns are changing. Simple actions like using less plastic, saving electricity, and planting trees can help. At my school, we started a club that organises tree planting and teaches people about protecting the environment. I believe that if everyone makes small changes, we can create a better future for the next generation.',
      wordCount: 76,
      level: 'B2 First',
    },
    {
      title: 'Technology and Learning',
      text: 'Technology has changed how we learn and communicate with each other. Today, students can watch educational videos, attend online classes, and find information about any topic quickly. However, too much screen time can harm our health and focus. It is important to balance technology with physical activities and real conversations. In my experience, the best learning happens when we combine digital tools with traditional methods like reading books and talking with teachers.',
      wordCount: 72,
      level: 'B2 First',
    },
    {
      title: 'The Art of Public Speaking',
      text: 'Public speaking used to frighten me more than anything else. My hands would shake and my voice would tremble when speaking in front of others. Last year, I joined the debate club to face this fear. At first, I forgot my points and stumbled over words. But with practice and support from teammates, I slowly improved. Now I can express ideas clearly and confidently. This taught me that the only way to beat fear is to face it. Every challenge we overcome makes us stronger.',
      wordCount: 85,
      level: 'B2 First',
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
    if (age <= 11) return '10-11';
    return '12-15';
  };

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
  const isFormValid = formData.parentName && isEmailValid && isPhoneValid && formData.childName && formData.childAge && parseInt(formData.childAge) >= 4 && parseInt(formData.childAge) <= 15;

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
                  max="15"
                  value={formData.childAge}
                  onChange={(e) => updateField('childAge', e.target.value)}
                  placeholder="Age (4-15 years)"
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
                      <Button onClick={stopRecording} variant="destructive" size="lg" className="bg-red-600 hover:bg-red-700 px-8">
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
