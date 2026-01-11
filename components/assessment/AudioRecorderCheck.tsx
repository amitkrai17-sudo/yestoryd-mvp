"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AudioRecorderCheck({ 
  onReady 
}: { 
  onReady: (mimeType: string) => void 
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      // 1. Check API existence
      if (typeof window === "undefined" || !window.navigator?.mediaDevices?.getUserMedia) {
        setError("Your browser does not support audio recording.");
        return;
      }

      // 2. Check for supported MIME types (Critical for Android)
      const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus"
      ];

      const supportedType = types.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedType) {
        setError("Audio format not compatible with this device.");
        return;
      }

      // 3. All good - pass the supported type
      onReady(supportedType);
    };

    checkSupport();
  }, [onReady]);

  if (!error) return null; // Invisible if all good

  // --- FALLBACK UI ---
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-900 text-sm">
            Device Recording Unavailable
          </h4>
          <p className="text-amber-800 text-xs mt-1 leading-relaxed">
            {error}. Don't worry! You can still send us the recording via WhatsApp.
          </p>
          
          <Button 
            variant="outline" 
            className="mt-3 w-full border-green-600 text-green-700 hover:bg-green-50"
            onClick={() => window.open(
              `https://wa.me/918976287997?text=Hi, my device couldn't record. I want to submit the reading assessment for my child.`, 
              '_blank'
            )}
          >
            <Send className="w-4 h-4 mr-2" />
            Send via WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
