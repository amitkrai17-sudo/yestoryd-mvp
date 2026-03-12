// file: app/admin/agreements/page.tsx
// Admin page to manage agreement versions AND edit agreement variables
// Thin orchestrator — delegates to _components/

'use client';

import { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  X,
  ArrowLeft,
  Settings,
  FileSignature,
} from 'lucide-react';
import Link from 'next/link';
import AgreementTable, { type AgreementVersion } from './_components/AgreementTable';
import { UploadModal, PreviewModal } from './_components/AgreementModal';
import AgreementSettings from './_components/AgreementSettings';

export default function AdminAgreementsPage() {
  const [activeTab, setActiveTab] = useState<'agreements' | 'variables'>('agreements');

  // Agreements state
  const [agreements, setAgreements] = useState<AgreementVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  // Variables tab change indicator
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchAgreements();
  }, []);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/agreements');
      const data = await response.json();
      if (data.success) {
        setAgreements(data.agreements);
      } else {
        setError(data.error || 'Failed to fetch agreements');
      }
    } catch {
      setError('Failed to fetch agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm('Are you sure you want to activate this agreement? All new coach signups will see this version.')) {
      return;
    }

    setActivating(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/agreements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        fetchAgreements();
      } else {
        setError(data.error || 'Activation failed');
      }
    } catch {
      setError('Activation failed. Please try again.');
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (id: string, version: string) => {
    if (!confirm(`Are you sure you want to delete agreement v${version}? This cannot be undone.`)) {
      return;
    }

    setDeleting(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/agreements/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        fetchAgreements();
      } else {
        setError(data.error || 'Deletion failed');
      }
    } catch {
      setError('Deletion failed. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = (agreement: AgreementVersion) => {
    setShowPreview(agreement.id);
  };

  return (
    <div className="bg-surface-0">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-text-tertiary hover:text-text-secondary">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-6 h-6 text-gray-400" />
                  Agreement Management
                </h1>
                <p className="text-sm text-text-tertiary">Upload agreements & configure variables</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchAgreements()}
                className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-surface-3 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-border -mb-px">
            <button
              onClick={() => setActiveTab('agreements')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'agreements'
                  ? 'border-white/50 text-white'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <FileSignature className="w-4 h-4 inline mr-2" />
              Agreement Documents
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'variables'
                  ? 'border-white/50 text-white'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Agreement Variables
              {hasChanges && <span className="ml-2 w-2 h-2 bg-orange-500 rounded-full inline-block" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Agreements Tab */}
        {activeTab === 'agreements' && (
          <>
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowUploadForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-[#0a0a0f] rounded-lg hover:bg-gray-200 transition-all font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload New Version
              </button>
            </div>

            <UploadModal
              open={showUploadForm}
              onClose={() => setShowUploadForm(false)}
              onSuccess={fetchAgreements}
              setError={setError}
              setSuccessMsg={setSuccess}
            />

            <PreviewModal
              agreementId={showPreview}
              onClose={() => setShowPreview(null)}
            />

            <AgreementTable
              agreements={agreements}
              loading={loading}
              activating={activating}
              deleting={deleting}
              onShowUploadForm={() => setShowUploadForm(true)}
              onActivate={handleActivate}
              onDelete={handleDelete}
              onPreview={handlePreview}
            />
          </>
        )}

        {/* Variables Tab */}
        {activeTab === 'variables' && (
          <AgreementSettings
            setError={setError}
            setSuccess={setSuccess}
            hasChanges={hasChanges}
            setHasChanges={setHasChanges}
          />
        )}
      </div>
    </div>
  );
}
