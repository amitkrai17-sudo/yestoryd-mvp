'use client';

import { useRef, useState, useEffect } from 'react';
import { Upload, CheckCircle, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/lib/supabase/client';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  setError: (error: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

interface PreviewModalProps {
  agreementId: string | null;
  onClose: () => void;
}

export function UploadModal({ open, onClose, onSuccess, setError, setSuccessMsg }: UploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadEntityType, setUploadEntityType] = useState('proprietorship');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setUploadFile(null);
    setUploadVersion('');
    setUploadTitle('');
    setUploadDescription('');
    setUploadEntityType('proprietorship');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.docx')) {
        setError('Only .docx files are allowed');
        return;
      }
      setUploadFile(file);
      const match = file.name.match(/v?(\d+\.?\d*)/i);
      if (match) {
        setUploadVersion(match[1]);
      }
      setUploadTitle(`Coach Service Agreement v${match?.[1] || ''}`);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadVersion || !uploadTitle) {
      setError('Please fill all required fields');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('version', uploadVersion);
      formData.append('title', uploadTitle);
      formData.append('description', uploadDescription);
      formData.append('entityType', uploadEntityType);
      const { data: { user } } = await supabase.auth.getUser();
      formData.append('uploadedByEmail', user?.email || 'admin');

      const response = await fetch('/api/admin/agreements/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMsg('Agreement uploaded successfully!');
        handleClose();
        onSuccess();
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Upload New Agreement</h2>
          <button onClick={handleClose} className="text-text-tertiary hover:text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Agreement File (.docx) *
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-white/[0.30] transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                className="hidden"
              />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span>{uploadFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-text-tertiary hover:text-white"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <span>Click to select DOCX file</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Version Number *</label>
            <input
              type="text"
              value={uploadVersion}
              onChange={(e) => setUploadVersion(e.target.value)}
              placeholder="e.g., 2.1"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white placeholder:text-text-muted"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Title *</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g., Coach Service Agreement v2.1"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white placeholder:text-text-muted"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Entity Type</label>
            <select
              value={uploadEntityType}
              onChange={(e) => setUploadEntityType(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white"
            >
              <option value="proprietorship">Proprietorship</option>
              <option value="llp">LLP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Description (Optional)</label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Notes about this version..."
              rows={2}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white placeholder:text-text-muted"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-border text-text-secondary rounded-lg hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !uploadFile || !uploadVersion || !uploadTitle}
              className="flex-1 px-4 py-2 bg-white text-[#0a0a0f] rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <><Spinner size="sm" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PreviewModal({ agreementId, onClose }: PreviewModalProps) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    if (!agreementId) return;
    setPreviewLoading(true);
    setPreviewHtml('');
    (async () => {
      try {
        const response = await fetch('/api/agreement/active');
        const data = await response.json();
        if (data.success) {
          setPreviewHtml(data.html);
        } else {
          setPreviewHtml(`<p class="text-red-500">Error: ${data.error}</p>`);
        }
      } catch {
        setPreviewHtml('<p class="text-red-500">Failed to load preview</p>');
      } finally {
        setPreviewLoading(false);
      }
    })();
  }, [agreementId]);

  if (!agreementId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-white">Agreement Preview (with variables replaced)</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" color="muted" />
            </div>
          ) : (
            <div className="text-text-secondary" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>
      </div>
    </div>
  );
}
