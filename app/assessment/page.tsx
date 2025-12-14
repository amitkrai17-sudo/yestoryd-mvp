'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Mic, 
  Square, 
  Play, 
  Pause,
  RotateCcw,
  Send,
  CheckCircle2,
  Sparkles,
  Clock,
  BookOpen,
  Star,
  Phone,
  Mail,
  User,
  Baby,
  ChevronDown,
  Loader2,
  Volume2,
  Award,
  TrendingUp,
  MessageCircle,
  Calendar,
  Share2,
  LogOut,
  GraduationCap,
  Shield,
  Rocket
} from 'lucide-react';

// ==================== ANALYTICS ====================
const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params);
    console.log(`📊 GA4: ${eventName}`, params);
  }
};

// ==================== CONFIGURATION ====================

const COLORS = {
  pink: '#ff0099',
  blue: '#00abff',
  yellow: '#ffde00',
  purple: '#7b008b',
};

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 5 passages per age group (50-130 words, Oxford/Cambridge level)
const PASSAGES: Record<string, { text: string; level: string }[]> = {
  '4-5': [
    {
      text: "I have a red ball. The ball is big and round. I kick the ball. It goes far away. I run fast to get it. My dog runs with me. We play all day. The sun is hot. I am very happy.",
      level: "Pre-A1 Starters"
    },
    {
      text: "I see a small cat. The cat has soft white fur. It has big green eyes. The cat sleeps on my bed. It likes warm milk. I love my cat. We play with a red ball. The cat is my best friend.",
      level: "Pre-A1 Starters"
    },
    {
      text: "I go to the park with Mum. The park has big trees and green grass. I play on the swing. It goes up and down. I see a bird in the tree. The bird sings a song. I like the park very much.",
      level: "Pre-A1 Starters"
    },
    {
      text: "Today I went to school. I sat with my friend Tom. We read a book about a frog. The frog was green and small. It could jump very high. After school, I told Mum about the frog. She smiled and gave me a hug.",
      level: "Pre-A1 Starters"
    },
    {
      text: "My family has a pet fish. The fish is orange and gold. It swims round and round in its tank. I feed the fish every morning. The fish comes up to eat the food. I like to watch it swim. My fish makes me happy every day.",
      level: "Pre-A1 Starters"
    },
  ],
  '6-7': [
    {
      text: "Last summer, we went to the beach. The sand was warm under my feet. I made a big sandcastle with my sister. The waves came and washed it away. We laughed and built another one. Dad bought us ice cream. It was the best day of the summer holidays.",
      level: "A1 Movers"
    },
    {
      text: "My grandmother lives in a small village. She has a beautiful garden with many flowers. When I visit her, we pick tomatoes and carrots together. She makes the best soup in the world. At night, she tells me stories about when she was young. I love spending time with my grandmother. Her house always smells like fresh bread.",
      level: "A1 Movers"
    },
    {
      text: "There is a big library near my school. Every week, my class goes there to borrow books. I like books about animals and space. Last week, I found a book about dinosaurs. It had many colourful pictures. The librarian is very kind and helps us find good books. Reading makes me feel like I can go anywhere in the world.",
      level: "A1 Movers"
    },
    {
      text: "My best friend is called Sam. We met on the first day of school. Sam is funny and kind. We like to play football together at break time. Sometimes we trade snacks from our lunch boxes. When I was sick, Sam made me a card. It said get well soon with a drawing of us playing. I am lucky to have such a good friend.",
      level: "A1 Movers"
    },
    {
      text: "Every Saturday, my dad and I go to the market. There are many stalls with fruits, vegetables, and flowers. I help Dad choose the best apples and oranges. The man who sells fish always gives me a smile. After shopping, we stop at a cafe for hot chocolate. I like watching all the people walking by. The market is noisy but fun. It is my favourite part of the week.",
      level: "A1 Movers"
    },
  ],
  '8-9': [
    {
      text: "The rainforest is home to millions of animals and plants. Tall trees grow so high that their leaves block out the sun. Colourful birds fly between the branches while monkeys swing from tree to tree. On the forest floor, insects and frogs hide among the fallen leaves. Scientists believe there are still many species we have not discovered. It is important to protect these forests so that all these amazing creatures have a place to live.",
      level: "A2 Flyers"
    },
    {
      text: "Long ago, the ancient Egyptians built enormous pyramids in the desert. These huge structures were tombs for their kings, called pharaohs. The Great Pyramid of Giza is one of the Seven Wonders of the Ancient World. It took thousands of workers many years to build. The Egyptians did not have modern machines, so they used ramps and rollers to move the heavy stones. Inside the pyramids, archaeologists have found treasures, paintings, and mummies. The pyramids still stand today, reminding us of this incredible civilisation.",
      level: "A2 Flyers"
    },
    {
      text: "The water cycle is one of nature most important processes. It begins when the sun heats water in oceans, lakes, and rivers. This causes the water to evaporate and rise into the sky as invisible vapour. As the vapour rises higher, it cools down and forms clouds. When the clouds become heavy with water droplets, rain or snow falls back to Earth. This water flows into rivers and streams, eventually returning to the ocean. The cycle then starts all over again, bringing fresh water to plants, animals, and people.",
      level: "A2 Flyers"
    },
    {
      text: "The invention of the printing press changed the world forever. Before Johannes Gutenberg invented it in 1440, books had to be written by hand. This made them very expensive and rare. Only wealthy people and churches could afford them. The printing press allowed books to be made quickly and cheaply. Soon, more people could learn to read. Ideas spread faster than ever before. Libraries grew larger, and schools could teach more students. Some historians say the printing press was the most important invention of the last thousand years. It helped create the modern world we live in today.",
      level: "A2 Flyers"
    },
    {
      text: "Every year, millions of birds make incredible journeys across the world. This is called migration. Birds travel to find food and warmer weather. The Arctic tern makes the longest journey of any animal, flying from the Arctic to the Antarctic and back again. That is a round trip of about seventy thousand kilometres. Scientists are still learning how birds know where to go. Some use the position of the sun and stars. Others follow the Earth magnetic field. Young birds often learn the route by following their parents. Migration is one of nature most amazing wonders.",
      level: "A2 Flyers"
    },
  ],
  '10-11': [
    {
      text: "The Amazon River is the largest river in the world by volume. It carries more water than any other river on Earth. The Amazon flows through South America, passing through Brazil, Peru, and several other countries. Its basin is home to the Amazon rainforest, which produces about twenty percent of the world oxygen. Thousands of unique species live in and around the river, including pink dolphins, piranhas, and giant otters. Indigenous communities have lived along its banks for thousands of years. Protecting the Amazon is vital for the health of our entire planet.",
      level: "B1 Preliminary"
    },
    {
      text: "The human brain is the most complex organ in our body. It contains about eighty-six billion neurons, which are special cells that send electrical signals to each other. These signals control everything we do, from breathing and walking to thinking and dreaming. Different parts of the brain handle different tasks. The frontal lobe helps us make decisions and solve problems. The temporal lobe processes sounds and helps us understand language. Scientists are still discovering new things about how the brain works. One amazing fact is that your brain uses about twenty percent of all the energy your body produces, even though it only weighs about one and a half kilograms.",
      level: "B1 Preliminary"
    },
    {
      text: "Climate change is one of the biggest challenges facing our world today. The Earth temperature has been rising because of greenhouse gases released by burning fossil fuels like coal, oil, and gas. This warming is causing ice caps to melt, sea levels to rise, and weather patterns to change. Many animals and plants are struggling to survive in their changing habitats. However, people around the world are working on solutions. Scientists are developing renewable energy sources like solar and wind power. Governments are creating laws to reduce pollution. Young people are raising awareness and demanding action. Everyone can help by saving energy, reducing waste, and making environmentally friendly choices. Together, we can make a difference.",
      level: "B1 Preliminary"
    },
    {
      text: "The Renaissance was a period of great cultural and artistic achievement in Europe. It began in Italy around the fourteenth century and spread across the continent over the next two hundred years. The word Renaissance means rebirth in French. During this time, artists, scientists, and thinkers rediscovered ideas from ancient Greece and Rome. Famous artists like Leonardo da Vinci and Michelangelo created masterpieces that are still admired today. Leonardo painted the Mona Lisa and designed flying machines. Michelangelo sculpted the statue of David and painted the ceiling of the Sistine Chapel. The Renaissance also saw advances in science, with scholars like Galileo challenging old beliefs about the universe. This period laid the foundation for the modern world.",
      level: "B1 Preliminary"
    },
    {
      text: "Space exploration has taught us incredible things about our universe. In 1969, Neil Armstrong became the first human to walk on the Moon. Since then, we have sent robots to Mars, spacecraft past Pluto, and telescopes into deep space. The International Space Station has been orbiting Earth since 1998, with astronauts from many countries living and working together. They conduct experiments that help us understand how the human body reacts to space and develop new technologies. Recently, private companies have started building their own rockets, making space travel more accessible. Scientists hope that one day humans might live on the Moon or even Mars. Each discovery brings new questions and possibilities. The universe is vast, and we have only begun to explore it.",
      level: "B1 Preliminary"
    },
  ],
  '12+': [
    {
      text: "Artificial intelligence is transforming how we live and work. AI systems can now recognise faces, translate languages, and even drive cars. Machine learning, a type of AI, allows computers to improve their performance by analysing large amounts of data. This technology powers recommendation systems on streaming services, voice assistants like Siri and Alexa, and medical tools that help doctors diagnose diseases. However, AI also raises important questions. How do we ensure these systems are fair and unbiased? Who is responsible when an AI makes a mistake? As AI becomes more powerful, society must carefully consider how to use it wisely and ethically.",
      level: "B2 First"
    },
    {
      text: "Democracy has evolved significantly since its origins in ancient Athens. In that early system, citizens gathered to vote directly on laws and policies. However, only free adult men could participate, excluding women, slaves, and foreigners. Today, most democracies are representative, meaning citizens elect officials to make decisions on their behalf. Modern democracies also protect individual rights through constitutions and courts. The twentieth century saw democracy spread across the globe, though it still faces challenges. Some countries struggle with corruption or restrictions on free speech. Others debate how to balance majority rule with protecting minority rights. Understanding democracy history helps us appreciate its value and recognise the ongoing work needed to strengthen it.",
      level: "B2 First"
    },
    {
      text: "The discovery of DNA revolutionised our understanding of life itself. In 1953, James Watson and Francis Crick described the double helix structure of DNA, building on work by Rosalind Franklin and others. DNA contains the genetic instructions that make each living thing unique. Every cell in your body contains the same DNA, which determines everything from your eye colour to your risk of certain diseases. Scientists have now mapped the entire human genome, opening new possibilities for medicine. Genetic testing can identify inherited conditions, while gene therapy offers hope for treating previously incurable diseases. However, these advances also raise ethical questions about privacy, designer babies, and genetic discrimination. The DNA revolution continues to shape our future.",
      level: "B2 First"
    },
    {
      text: "Global trade connects economies and cultures around the world. When you buy a smartphone, its components may come from dozens of countries. Rare minerals from Africa, chips from Taiwan, and software from America all come together in one device. This interconnection has lifted millions out of poverty and given consumers access to affordable goods. However, globalisation also creates challenges. Workers in some countries face poor conditions, while others lose jobs when companies move production overseas. Environmental costs mount as goods travel thousands of miles. The COVID pandemic revealed how disruptions in one region can affect supply chains worldwide. Finding the right balance between free trade and protecting workers, communities, and the environment remains one of the great challenges of our time.",
      level: "B2 First"
    },
    {
      text: "The scientific method has been humanity greatest tool for understanding the natural world. It begins with observation and questioning. Scientists then form hypotheses, which are educated guesses that can be tested. Through carefully designed experiments, they gather data and analyse results. If the evidence supports the hypothesis, it may eventually become part of an accepted theory. Importantly, science is self-correcting. When new evidence contradicts old ideas, scientists revise their understanding. This process has given us vaccines, electricity, computers, and countless other advances. However, science also requires trust and integrity. Researchers must report their findings honestly, and others must be able to replicate their experiments. Scientific literacy helps citizens evaluate claims and make informed decisions about issues like climate change, public health, and new technologies.",
      level: "B2 First"
    },
  ],
};

// Get passage for age
function getPassageForAge(age: number): { text: string; level: string } {
  let key: string;
  if (age <= 5) key = '4-5';
  else if (age <= 7) key = '6-7';
  else if (age <= 9) key = '8-9';
  else if (age <= 11) key = '10-11';
  else key = '12+';
  
  const passages = PASSAGES[key];
  return passages[Math.floor(Math.random() * passages.length)];
}

// Score-based CTA messaging
function getScoreBasedCTA(score: number, childName: string) {
  if (score <= 4) {
    return {
      headline: `${childName} needs expert guidance`,
      primaryCTA: `Get ${childName} the Help They Need`,
      subtext: 'Our coaches specialize in building reading confidence',
      emoji: '🆘',
    };
  } else if (score <= 6) {
    return {
      headline: `${childName} is ready to improve!`,
      primaryCTA: `Accelerate ${childName}'s Progress`,
      subtext: 'With the right guidance, improvement comes fast',
      emoji: '📈',
    };
  } else if (score <= 8) {
    return {
      headline: `${childName} shows great potential!`,
      primaryCTA: `Unlock ${childName}'s Full Potential`,
      subtext: 'Take reading skills to the next level',
      emoji: '⭐',
    };
  } else {
    return {
      headline: `${childName} is a reading star!`,
      primaryCTA: `Challenge ${childName} Further`,
      subtext: 'Advanced coaching for gifted readers',
      emoji: '🌟',
    };
  }
}

// ==================== MAIN COMPONENT ====================

export default function AssessmentPage() {
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    parentName: '',
    parentEmail: '',
    countryCode: '+91',
    parentPhone: '',
    childName: '',
    childAge: '',
  });
  
  // Recording state
  const [passage, setPassage] = useState<{ text: string; level: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setFormData(prev => ({
            ...prev,
            parentName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            parentEmail: session.user.email || '',
          }));
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setFormData(prev => ({
          ...prev,
          parentName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || prev.parentName,
          parentEmail: session.user.email || prev.parentEmail,
        }));
      } else {
        setUser(null);
      }
      setIsGoogleLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // ==================== HANDLERS ====================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    // Track sign in attempt
    trackEvent('login_started', { method: 'google' });
    try {
      const currentUrl = window.location.href;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: currentUrl,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in error:', error);
      setIsGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFormData(prev => ({
      ...prev,
      parentName: '',
      parentEmail: '',
    }));
  };

  const handleStartAssessment = () => {
    if (!formData.parentName || !formData.parentEmail || !formData.childName || !formData.childAge) {
      alert('Please fill all required fields');
      return;
    }
    
    // Track assessment started
    trackEvent('assessment_started', { child_age: formData.childAge });
    
    const age = parseInt(formData.childAge);
    const selectedPassage = getPassageForAge(age);
    setPassage(selectedPassage);
    setCurrentStep(2);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Track recording started
      trackEvent('recording_started');
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Please allow microphone access to record your reading.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Track recording completed
      trackEvent('recording_completed', { duration_seconds: recordingTime });
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const handleSubmitRecording = async () => {
    if (!audioBlob || !passage) return;
    
    setIsAnalyzing(true);
    
    try {
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      const fullPhone = formData.parentPhone ? `${formData.countryCode}${formData.parentPhone}` : '';

      const response = await fetch('/api/assessment/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: audioBase64,
          passage: passage.text,
          childName: formData.childName,
          childAge: formData.childAge,
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: fullPhone,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setResults(data);
      setCurrentStep(3);

      // Track assessment completed
      trackEvent('assessment_completed', { 
        child_name: formData.childName, 
        score: data.overall_score, 
        child_age: formData.childAge 
      });

      // Send certificate email with consistent data (numbers not words)
      try {
        await fetch('/api/certificate/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childName: formData.childName,
            childAge: formData.childAge,
            parentName: formData.parentName,
            email: formData.parentEmail,
            score: data.overall_score,
            clarity_score: data.clarity_score,
            fluency_score: data.fluency_score,
            speed_score: data.speed_score,
            wpm: data.wpm,
            feedback: data.feedback,
          }),
        });
      } catch (emailError) {
        console.error('Certificate email error:', emailError);
      }

    } catch (error) {
      console.error('Analysis error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // WhatsApp share with FULL feedback
  const shareToWhatsApp = () => {
    if (!results) return;
    
    // Track share event
    trackEvent('results_shared', { platform: 'whatsapp', child_name: formData.childName });
    
    const ctaInfo = getScoreBasedCTA(results.overall_score, formData.childName);
    
    const text = `📚 *Yestoryd Reading Report for ${formData.childName}*

${ctaInfo.emoji} *Overall Score: ${results.overall_score}/10*

📊 *Detailed Scores:*
🔊 Clarity: ${results.clarity_score}/10
🗣️ Fluency: ${results.fluency_score}/10
⚡ Speed: ${results.speed_score}/10
📈 WPM: ${results.wpm}

💬 *Vedant AI Feedback:*
${results.feedback}

✨ ${results.encouragement}

━━━━━━━━━━━━━━━

🎯 *${ctaInfo.headline}*
${ctaInfo.subtext}

📅 Book FREE Coach Call for ${formData.childName}:
https://yestoryd.com/book

📧 Certificate sent to ${formData.parentEmail}
Check spam folder if not in inbox!

━━━━━━━━━━━━━━━
🚀 Get your FREE assessment at yestoryd.com`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(255, 0, 153, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(0, 171, 255, 0.1) 0%, transparent 50%)',
          }}
        />
        <div className="absolute top-20 left-10 w-72 h-72 bg-pink-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="bg-gray-950/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">Back</span>
            </Link>
            
            <Link href="/" className="absolute left-1/2 -translate-x-1/2">
              <Image 
                src="/images/logo.png" 
                alt="Yestoryd" 
                width={140} 
                height={45}
                className="h-9 w-auto"
              />
            </Link>

            <a
              href="https://wa.me/918976287997"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-full text-sm font-medium hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-10 relative z-10">
        {/* Page Title */}
        <div className="text-center mb-6 md:mb-8">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-3"
            style={{ backgroundColor: 'rgba(255, 222, 0, 0.2)', color: COLORS.yellow }}
          >
            <Sparkles className="w-4 h-4" />
            FREE READING ASSESSMENT
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
            Know Your Child&apos;s Reading Level
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            Get AI-powered insights in just 5 minutes
          </p>
        </div>

        {/* Progress Stepper - NO LINE */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Details', icon: User },
              { num: 2, label: 'Record', icon: Mic },
              { num: 3, label: 'Results', icon: Award },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    currentStep >= step.num 
                      ? 'text-white shadow-lg' 
                      : 'bg-gray-800 text-gray-500'
                  }`}
                  style={currentStep >= step.num ? {
                    background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})`
                  } : {}}
                >
                  {currentStep > step.num ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-6 h-6" />
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium ${
                  currentStep >= step.num ? 'text-white' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            
            {/* STEP 1: DETAILS */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Vedant AI Introduction */}
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-2xl border border-pink-500/20">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Vedant AI</h3>
                    <p className="text-gray-400 text-sm">Your AI Reading Coach is ready to help!</p>
                  </div>
                </div>

                {/* Google Sign-In */}
                {authLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
                  </div>
                ) : user ? (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.user_metadata?.avatar_url && (
                          <Image
                            src={user.user_metadata.avatar_url}
                            alt={user.user_metadata?.full_name || 'User'}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        )}
                        <div>
                          <p className="text-white font-medium">{user.user_metadata?.full_name || user.email}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
                        title="Sign out"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-green-400 text-xs mt-3 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Signed in with Google - details auto-filled!
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-4 px-6 rounded-2xl hover:bg-gray-100 transition-all shadow-lg disabled:opacity-50"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </button>
                )}

                {/* Divider */}
                {!user && !authLoading && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-700" />
                    <span className="text-gray-500 text-sm">or fill details</span>
                    <div className="flex-1 h-px bg-gray-700" />
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <User className="w-4 h-4 inline mr-2" />
                      Parent Name *
                    </label>
                    <input
                      type="text"
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleInputChange}
                      placeholder="Enter your name"
                      disabled={!!user}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="parentEmail"
                      value={formData.parentEmail}
                      onChange={handleInputChange}
                      placeholder="you@email.com"
                      disabled={!!user}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Phone with Country Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Phone className="w-4 h-4 inline mr-2" />
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="countryCode"
                        value={formData.countryCode}
                        onChange={handleInputChange}
                        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      >
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+971">🇦🇪 +971</option>
                        <option value="+65">🇸🇬 +65</option>
                        <option value="+61">🇦🇺 +61</option>
                        <option value="+60">🇲🇾 +60</option>
                        <option value="+974">🇶🇦 +974</option>
                        <option value="+966">🇸🇦 +966</option>
                        <option value="+49">🇩🇪 +49</option>
                      </select>
                      <input
                        type="tel"
                        name="parentPhone"
                        value={formData.parentPhone}
                        onChange={handleInputChange}
                        placeholder="98765 43210"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Baby className="w-4 h-4 inline mr-2" />
                        Child Name *
                      </label>
                      <input
                        type="text"
                        name="childName"
                        value={formData.childName}
                        onChange={handleInputChange}
                        placeholder="Child's name"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Star className="w-4 h-4 inline mr-2" />
                        Age *
                      </label>
                      <div className="relative">
                        <select
                          name="childAge"
                          value={formData.childAge}
                          onChange={handleInputChange}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                        >
                          <option value="">Select</option>
                          {Array.from({ length: 11 }, (_, i) => i + 4).map(age => (
                            <option key={age} value={age}>{age} years</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleStartAssessment}
                  className="w-full font-bold py-4 px-6 rounded-2xl text-white transition-all duration-300 hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3"
                  style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }}
                >
                  <BookOpen className="w-5 h-5" />
                  Start Free Assessment
                </button>

                <p className="text-center text-gray-500 text-xs">
                  🔒 Your information is secure and will never be shared
                </p>
              </div>
            )}

            {/* STEP 2: RECORD */}
            {currentStep === 2 && passage && (
              <div className="space-y-6">
                {/* Passage Card with Level Badge */}
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-blue-400 text-sm font-medium flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Read this passage aloud
                    </span>
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 px-3 py-1.5 rounded-full">
                      <GraduationCap className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-300 text-xs font-semibold">{passage.level}</span>
                    </div>
                  </div>
                  
                  <p className="text-white text-lg leading-relaxed">
                    {passage.text}
                  </p>
                </div>

                {/* Instructions */}
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-pink-400" />
                    Instructions for {formData.childName}
                  </h4>
                  <ol className="text-gray-400 text-sm space-y-1">
                    <li>1. Read the entire passage aloud clearly</li>
                    <li>2. Take your time - accuracy matters more than speed</li>
                    <li>3. Click stop when finished reading</li>
                  </ol>
                </div>

                {/* Recording Controls */}
                <div className="flex flex-col items-center gap-4">
                  <div className={`text-3xl font-mono font-bold ${isRecording ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {formatTime(recordingTime)}
                  </div>

                  {!audioBlob ? (
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                        isRecording 
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                          : 'hover:scale-105'
                      }`}
                      style={!isRecording ? { background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` } : {}}
                    >
                      {isRecording ? (
                        <Square className="w-10 h-10 text-white" />
                      ) : (
                        <Mic className="w-10 h-10 text-white" />
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlayback}
                        className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-8 h-8 text-white" />
                        ) : (
                          <Play className="w-8 h-8 text-white ml-1" />
                        )}
                      </button>
                      
                      <button
                        onClick={resetRecording}
                        className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-colors"
                      >
                        <RotateCcw className="w-7 h-7 text-white" />
                      </button>
                    </div>
                  )}

                  {audioUrl && (
                    <audio 
                      ref={audioRef} 
                      src={audioUrl} 
                      onEnded={() => setIsPlaying(false)}
                    />
                  )}

                  <p className="text-gray-400 text-sm">
                    {isRecording ? '🔴 Recording... Click to stop' : 
                     audioBlob ? '✅ Recording complete! Review or re-record' : 
                     '🎤 Tap to start recording'}
                  </p>
                </div>

                {audioBlob && (
                  <button
                    onClick={handleSubmitRecording}
                    disabled={isAnalyzing}
                    className="w-full font-bold py-4 px-6 rounded-2xl text-white transition-all duration-300 hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Vedant AI is analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Get Results
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  ← Go back to details
                </button>
              </div>
            )}

            {/* STEP 3: RESULTS - CRO OPTIMIZED */}
            {currentStep === 3 && results && (
              <div className="space-y-6 text-center">
                <div>
                  <div className="text-4xl mb-2">🎉</div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    Great job, {formData.childName}!
                  </h2>
                  <p className="text-gray-400">Here&apos;s your reading assessment</p>
                </div>

                {/* Score Circle */}
                <div className="relative w-40 h-40 mx-auto">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle 
                      cx="80" cy="80" r="70" 
                      stroke="#1f2937" 
                      strokeWidth="12" 
                      fill="none" 
                    />
                    <circle 
                      cx="80" cy="80" r="70" 
                      stroke="url(#scoreGradient)" 
                      strokeWidth="12" 
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(results.overall_score / 10) * 440} 440`}
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={COLORS.pink} />
                        <stop offset="100%" stopColor={COLORS.purple} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-bold text-white">{results.overall_score}</span>
                  </div>
                </div>

                {/* Metric Pills - Numbers only */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Clarity', value: results.clarity_score, icon: '🔊' },
                    { label: 'Fluency', value: results.fluency_score, icon: '🗣️' },
                    { label: 'Speed', value: results.speed_score, icon: '⚡' },
                  ].map((metric) => (
                    <div 
                      key={metric.label}
                      className="bg-gray-800 rounded-xl p-3"
                    >
                      <div className="text-2xl mb-1">{metric.icon}</div>
                      <div className="text-xl font-bold text-white">{metric.value}</div>
                      <div className="text-gray-400 text-xs">{metric.label}</div>
                    </div>
                  ))}
                </div>

                {results.wpm && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-center gap-3">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    <span className="text-white font-medium">{results.wpm} Words Per Minute</span>
                  </div>
                )}

                {/* Feedback */}
                <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl p-4 text-left">
                  <h4 className="text-pink-400 font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Vedant AI Feedback
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {results.feedback}
                  </p>
                </div>

                {/* Encouragement */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-yellow-300 font-medium">
                    ✨ {results.encouragement}
                  </p>
                </div>

                {/* PERSONALIZED CTA SECTION */}
                {(() => {
                  const ctaInfo = getScoreBasedCTA(results.overall_score, formData.childName);
                  return (
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-5 space-y-4">
                      <div className="text-center">
                        <span className="text-3xl">{ctaInfo.emoji}</span>
                        <h3 className="text-xl font-bold text-white mt-2">{ctaInfo.headline}</h3>
                        <p className="text-gray-400 text-sm mt-1">{ctaInfo.subtext}</p>
                      </div>

                      {/* Social Proof */}
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <span className="text-orange-400">🔥</span>
                        <span className="text-gray-300">12 parents enrolled today</span>
                      </div>

                      {/* Primary CTA - Personalized */}
                      <Link
                        href={`/book?childName=${encodeURIComponent(formData.childName)}&childAge=${encodeURIComponent(formData.childAge)}&parentName=${encodeURIComponent(formData.parentName)}&parentEmail=${encodeURIComponent(formData.parentEmail)}&parentPhone=${encodeURIComponent(formData.countryCode + formData.parentPhone)}&score=${results.overall_score}`}
                        onClick={() => trackEvent('cta_clicked', { cta: 'primary_enroll', score: results.overall_score })}
                        className="w-full font-bold py-4 px-6 rounded-2xl text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }}
                      >
                        <Rocket className="w-5 h-5" />
                        {ctaInfo.primaryCTA}
                      </Link>

                      {/* Trust badges */}
                      <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          100% Refund Guarantee
                        </span>
                        <span>•</span>
                        <span>500+ Kids Improved</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Secondary CTA */}
                <Link
                  href={`/book?childName=${encodeURIComponent(formData.childName)}&childAge=${encodeURIComponent(formData.childAge)}&parentName=${encodeURIComponent(formData.parentName)}&parentEmail=${encodeURIComponent(formData.parentEmail)}&parentPhone=${encodeURIComponent(formData.countryCode + formData.parentPhone)}&score=${results.overall_score}&type=consultation`}
                  onClick={() => trackEvent('cta_clicked', { cta: 'secondary_consultation', score: results.overall_score })}
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 font-semibold py-4 px-6 rounded-2xl text-white flex items-center justify-center gap-3 transition-all"
                >
                  <Calendar className="w-5 h-5" />
                  Talk to {formData.childName}&apos;s Coach First
                </Link>

                {/* WhatsApp Share - Full Feedback */}
                <button
                  onClick={() => {
                    trackEvent('cta_clicked', { cta: 'whatsapp_share', score: results.overall_score });
                    shareToWhatsApp();
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 font-bold py-4 px-6 rounded-2xl text-white flex items-center justify-center gap-3 transition-all"
                >
                  <Share2 className="w-5 h-5" />
                  Share {formData.childName}&apos;s Results
                </button>

                {/* Take Another */}
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setFormData(prev => ({
                      parentName: user?.user_metadata?.full_name || '',
                      parentEmail: user?.email || '',
                      countryCode: '+91',
                      parentPhone: '',
                      childName: '',
                      childAge: '',
                    }));
                    setResults(null);
                    setAudioBlob(null);
                    setAudioUrl(null);
                    setPassage(null);
                  }}
                  className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  🔄 Take Another Assessment
                </button>

                <p className="text-gray-500 text-xs">
                  📧 Certificate sent to {formData.parentEmail} (check spam folder if not in inbox)
                </p>
              </div>
            )}
          </div>

          {/* Powered by Vedant AI */}
          <div className="text-center mt-6">
            <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              Powered by <span className="text-white font-medium">Vedant AI</span> - Your Reading Coach
            </p>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-8 text-gray-500 text-xs">
          {[
            { icon: Clock, text: '5 Min Assessment' },
            { icon: Award, text: 'AI-Powered Analysis' },
            { icon: Mail, text: 'Instant Certificate' },
            { icon: MessageCircle, text: 'Expert Support' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-pink-400" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}