// app/yestoryd-academy/apply/page.tsx
// Coach Application Form - Step 1: Basic Info + Audio Statement + Credentials
// Google Sign-in for authentication

'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowRight,
  ArrowLeft,
  Mic,
  MicOff,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Pause,
  Trash2,
  FileText,
  X,
  Loader2
} from 'lucide-react';

// Audio Recording Component
function AudioRecorder({ 
  onRecordingComplete 
}: { 
  onRecordingComplete: (blob: Blob, duration: number) => void 
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const MAX_DURATION = 120; // 2 minutes

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        onRecordingComplete(blob, recordingTime);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Please allow microphone access to record your statement.');
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

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-6 border border-pink-100">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Statement of Purpose</h3>
          <p className="text-sm text-slate-600 mt-1">
            In 2 minutes, tell us: Why do you want to help children learn to read? 
            Share a moment when you made a difference in a child's learning journey.
          </p>
        </div>
      </div>

      {/* Recording Interface */}
      <div className="bg-white rounded-xl p-4">
        {!audioUrl ? (
          // Recording Mode
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-lg'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </button>
            </div>
            
            {isRecording ? (
              <div>
                <div className="text-2xl font-bold text-slate-900 mb-1">
                  {formatTime(recordingTime)}
                </div>
                <div className="text-sm text-slate-500">
                  {formatTime(MAX_DURATION - recordingTime)} remaining
                </div>
                <div className="mt-3 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all"
                    style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Click the microphone to start recording
              </p>
            )}
          </div>
        ) : (
          // Playback Mode
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={togglePlayback}
                className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 hover:shadow-lg transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
              
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  Recording complete
                </div>
                <div className="text-xs text-slate-500">
                  Duration: {formatTime(recordingTime)}
                </div>
              </div>
              
              <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
            </div>
            
            {/* Re-record button */}
            <button
              onClick={deleteRecording}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-red-500 hover:border-red-200 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">Delete & Re-record</span>
            </button>
          </div>
        )}
      </div>

      {audioUrl && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span>Audio recorded successfully</span>
        </div>
      )}
    </div>
  );
}

// File Upload Component
function FileUploader({
  label,
  description,
  accept,
  multiple,
  files,
  onFilesChange,
  required
}: {
  label: string;
  description: string;
  accept: string;
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (multiple) {
        onFilesChange([...files, ...newFiles]);
      } else {
        onFilesChange(newFiles);
      }
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        {label} {required && <span className="text-pink-500">*</span>}
      </label>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      
      <div 
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-pink-300 hover:bg-pink-50/50 transition-colors"
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-slate-400 mt-1">{accept}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <FileText className="w-5 h-5 text-slate-400" />
              <span className="flex-1 text-sm text-slate-700 truncate">{file.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="p-1 text-slate-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main Application Page
export default function CoachApplicationPage() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    qualification: '',
    currentOccupation: '',
    experienceYears: '',
    certificationsText: '',
    whyJoin: ''
  });

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [credentialFiles, setCredentialFiles] = useState<File[]>([]);

  // Check authentication
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setFormData(prev => ({
          ...prev,
          name: user.user_metadata?.full_name || '',
          email: user.email || ''
        }));
      }
      setCheckingAuth(false);
    };
    checkUser();
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/yestoryd-academy/apply`
      }
    });
    if (error) {
      console.error('Error signing in:', error);
      alert('Error signing in. Please try again.');
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return !!(formData.name && formData.email && formData.phone && formData.country && formData.city);
      case 2:
        return !!(formData.qualification && formData.currentOccupation);
      case 3:
        return !!(audioBlob && formData.whyJoin && formData.whyJoin.split(' ').length >= 30);
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      alert('Please complete all required fields and record your audio statement.');
      return;
    }

    setLoading(true);

    try {
      // Upload audio
      let audioUrl = null;
      if (audioBlob) {
        const audioFileName = `coach-audio/${user?.id || 'anon'}-${Date.now()}.webm`;
        const { data: audioData, error: audioError } = await supabase.storage
          .from('coach-applications')
          .upload(audioFileName, audioBlob);
        
        if (audioError) {
          console.error('Audio upload error:', audioError);
          throw new Error(`Audio upload failed: ${audioError.message}`);
        }
        audioUrl = audioData.path;
      }

      // Upload resume
      let resumeUrl = null;
      if (resumeFiles.length > 0) {
        const resumeFileName = `resumes/${user?.id || 'anon'}-${Date.now()}-${resumeFiles[0].name}`;
        const { data: resumeData, error: resumeError } = await supabase.storage
          .from('coach-applications')
          .upload(resumeFileName, resumeFiles[0]);
        
        if (resumeError) {
          console.error('Resume upload error:', resumeError);
          // Don't fail on resume error, it's optional
        } else {
          resumeUrl = resumeData.path;
        }
      }

      // Upload credentials
      const credentialUrls: string[] = [];
      for (const file of credentialFiles) {
        const fileName = `credentials/${user?.id || 'anon'}-${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from('coach-applications')
          .upload(fileName, file);
        
        if (!error && data) {
          credentialUrls.push(data.path);
        }
      }

      // Create application record
      const { data: application, error: appError } = await (supabase
        .from('coach_applications') as any)
        .insert({
          google_id: user?.id,
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          country: formData.country,
          city: formData.city,
          qualification: formData.qualification,
          current_occupation: formData.currentOccupation,
          experience_years: formData.experienceYears,
          certifications_text: formData.certificationsText,
          why_join: formData.whyJoin,
          audio_statement_url: audioUrl,
          audio_duration_seconds: audioDuration,
          resume_url: resumeUrl,
          credential_urls: credentialUrls.length > 0 ? credentialUrls : null,
          status: 'applied'
        })
        .select()
        .single();

      if (appError) {
        console.error('Database insert error:', appError);
        throw new Error(`Database error: ${appError.message}`);
      }

      // Redirect to AI assessment
      router.push(`/yestoryd-academy/assessment?applicationId=${application.id}`);

    } catch (error: any) {
      console.error('Error submitting application:', error);
      alert(`Error: ${error.message || 'Something went wrong. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/yestoryd-academy" className="flex items-center gap-2">
            <Image 
              src="/images/logo.png" 
              alt="Yestoryd" 
              width={120} 
              height={35}
              className="h-8 w-auto"
            />
          </Link>
          <div className="text-sm text-slate-500">
            Step {step} of 3
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Google Sign-in Gate */}
        {!user && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Start Your Application
            </h1>
            <p className="text-slate-600 mb-6">
              Sign in with Google to begin your journey with Yestoryd Academy.
            </p>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="inline-flex items-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-300 px-6 py-3 rounded-xl font-medium text-slate-700 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>
          </div>
        )}

        {/* Application Form */}
        {user && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Tell Us About Yourself
                </h1>
                <p className="text-slate-600 mb-8">
                  Basic information to get started.
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Full Name <span className="text-pink-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email <span className="text-pink-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 bg-slate-50"
                      placeholder="you@example.com"
                      readOnly
                    />
                    <p className="text-xs text-slate-500 mt-1">From your Google account</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      WhatsApp Number <span className="text-pink-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900"
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Country <span className="text-pink-500">*</span>
                    </label>
                    <select
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 bg-white"
                    >
                      <option value="">Select your country</option>
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="UAE">United Arab Emirates</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Germany">Germany</option>
                      <option value="Netherlands">Netherlands</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      City <span className="text-pink-500">*</span>
                    </label>
                    {formData.country === 'India' ? (
                      <select
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 bg-white"
                      >
                        <option value="">Select your city</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Delhi">Delhi</option>
                        <option value="Bangalore">Bangalore</option>
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Chennai">Chennai</option>
                        <option value="Kolkata">Kolkata</option>
                        <option value="Pune">Pune</option>
                        <option value="Ahmedabad">Ahmedabad</option>
                        <option value="Jaipur">Jaipur</option>
                        <option value="Lucknow">Lucknow</option>
                        <option value="Chandigarh">Chandigarh</option>
                        <option value="Indore">Indore</option>
                        <option value="Bhopal">Bhopal</option>
                        <option value="Nagpur">Nagpur</option>
                        <option value="Surat">Surat</option>
                        <option value="Kochi">Kochi</option>
                        <option value="Coimbatore">Coimbatore</option>
                        <option value="Visakhapatnam">Visakhapatnam</option>
                        <option value="Gurgaon">Gurgaon</option>
                        <option value="Noida">Noida</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900"
                        placeholder="Enter your city"
                      />
                    )}
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    disabled={!validateStep(1)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Professional Background */}
            {step === 2 && (
              <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Your Background
                </h1>
                <p className="text-slate-600 mb-8">
                  Help us understand your experience and qualifications.
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Highest Qualification <span className="text-pink-500">*</span>
                    </label>
                    <select
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 bg-white"
                    >
                      <option value="">Select...</option>
                      <option value="12th">12th Pass</option>
                      <option value="graduate">Graduate</option>
                      <option value="post_graduate">Post Graduate</option>
                      <option value="bed">B.Ed / D.Ed</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Current Occupation <span className="text-pink-500">*</span>
                    </label>
                    <select
                      name="currentOccupation"
                      value={formData.currentOccupation}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 bg-white"
                    >
                      <option value="">Select...</option>
                      <option value="teacher">Teacher</option>
                      <option value="tutor">Private Tutor</option>
                      <option value="homemaker">Homemaker</option>
                      <option value="professional">Working Professional</option>
                      <option value="freelancer">Freelancer</option>
                      <option value="student">Student</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Experience with Children
                    </label>
                    <select
                      name="experienceYears"
                      value={formData.experienceYears}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 bg-white"
                    >
                      <option value="">Select...</option>
                      <option value="none">No formal experience</option>
                      <option value="parent">Parent / Family caregiver</option>
                      <option value="1-2">1-2 years teaching/tutoring</option>
                      <option value="3-5">3-5 years teaching/tutoring</option>
                      <option value="5+">5+ years teaching/tutoring</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Certifications (if any)
                    </label>
                    <textarea
                      name="certificationsText"
                      value={formData.certificationsText}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 resize-none"
                      rows={3}
                      placeholder="E.g., Jolly Phonics, Cambridge TKT, Montessori, TEFL..."
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Certified coaches go through an accelerated onboarding path.
                    </p>
                  </div>

                  {/* File Uploads */}
                  <div className="pt-4 border-t border-slate-100">
                    <FileUploader
                      label="Resume / CV"
                      description="Upload your resume or CV (PDF, DOC, DOCX)"
                      accept=".pdf,.doc,.docx"
                      files={resumeFiles}
                      onFilesChange={setResumeFiles}
                    />
                  </div>

                  <FileUploader
                    label="Certificates & Credentials"
                    description="Upload any teaching certificates, diplomas, or credentials (optional)"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    files={credentialFiles}
                    onFilesChange={setCredentialFiles}
                  />
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 text-slate-600 px-4 py-3 font-medium hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!validateStep(2)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Statement of Purpose */}
            {step === 3 && (
              <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Your Statement of Purpose
                </h1>
                <p className="text-slate-600 mb-8">
                  Help us understand your motivation and passion.
                </p>

                <div className="space-y-6">
                  {/* Audio Recording */}
                  <AudioRecorder
                    onRecordingComplete={(blob, duration) => {
                      setAudioBlob(blob);
                      setAudioDuration(duration);
                    }}
                  />

                  {/* Written Response */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Written Statement <span className="text-pink-500">*</span>
                    </label>
                    <p className="text-sm text-slate-500 mb-3">
                      In your own words, why do you want to partner with Yestoryd to help children read better? 
                      <span className="inline-block ml-1 px-2 py-0.5 bg-pink-100 text-pink-700 font-semibold rounded-full text-xs">
                        Minimum 30 words
                      </span>
                    </p>
                    <textarea
                      name="whyJoin"
                      value={formData.whyJoin}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-pink-500 focus:ring-0 outline-none transition-colors text-slate-900 resize-none"
                      rows={5}
                      placeholder="Share your motivation, your experience with children, and what drives you to teach..."
                    />
                    <div className="flex justify-between mt-2">
                      <p className="text-xs text-slate-500">
                        {formData.whyJoin.split(' ').filter(w => w).length} words
                      </p>
                      {formData.whyJoin.split(' ').filter(w => w).length >= 30 && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Minimum met
                        </span>
                      )}
                    </div>
                  </div>

                  {/* What happens next */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">What happens next?</h4>
                        <p className="text-sm text-slate-600 mt-1">
                          After submitting, you'll have a conversation with Vedant AI to help us understand your approach to teaching. 
                          This takes about 15 minutes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 text-slate-600 px-4 py-3 font-medium hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!validateStep(3) || loading}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit & Continue to AI Assessment
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}