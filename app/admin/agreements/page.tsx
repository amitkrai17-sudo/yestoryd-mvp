// file: app/admin/agreements/page.tsx
// Admin page to manage agreement versions AND edit agreement variables
// Features: Upload DOCX, List versions, Activate, Delete, Preview, Edit Variables

'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Upload,
  FileText,
  Check,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
  Calendar,
  Users,
  Building2,
  RefreshCw,
  X,
  ArrowLeft,
  Settings,
  Save,
  IndianRupee,
  Percent,
  Clock,
  FileSignature,
  Edit3,
} from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AgreementVersion {
  id: string;
  version: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  is_active: boolean;
  entity_type: string;
  uploaded_by_email: string | null;
  created_at: string;
  activated_at: string | null;
  total_signatures: number;
}

interface ConfigVariable {
  key: string;
  value: string;
  description: string;
  category: string;
}

// Default variables with categories
const DEFAULT_VARIABLES: ConfigVariable[] = [
  // Company Details
  { key: 'company_name', value: 'Yestoryd', description: 'Company/Brand name', category: 'company' },
  { key: 'company_address', value: 'A 703, Mahavir Dham CHS, Plot No 27 & 28, Sector 40, Seawoods, Navi Mumbai, Maharashtra - 400706', description: 'Registered address', category: 'company' },
  { key: 'company_email', value: 'rucha.rai@yestoryd.com', description: 'Company email', category: 'company' },
  { key: 'company_phone', value: '8976287997', description: 'Company phone', category: 'company' },
  { key: 'company_website', value: 'https://yestoryd.com', description: 'Company website', category: 'company' },
  { key: 'company_gstin', value: '27AOQPD7421L1ZL', description: 'GST Number', category: 'company' },
  { key: 'company_udyam', value: 'UDYAM-MH-19-0208177', description: 'UDYAM Registration', category: 'company' },
  { key: 'company_pan', value: 'AOQPD7421L', description: 'PAN Number', category: 'company' },
  { key: 'proprietor_name', value: 'Rucha Amitkumar Rai', description: 'Proprietor legal name', category: 'company' },
  { key: 'entity_type', value: 'Sole Proprietorship', description: 'Business entity type', category: 'company' },
  
  // Revenue Split
  { key: 'lead_cost_percent', value: '20', description: 'Lead cost percentage', category: 'revenue' },
  { key: 'coach_cost_percent', value: '50', description: 'Coach cost percentage', category: 'revenue' },
  { key: 'platform_fee_percent', value: '30', description: 'Platform fee percentage', category: 'revenue' },
  
  // TDS
  { key: 'tds_rate_standard', value: '10', description: 'Standard TDS rate with PAN (%)', category: 'tds' },
  { key: 'tds_rate_no_pan', value: '20', description: 'TDS rate without PAN (%)', category: 'tds' },
  { key: 'tds_threshold', value: '30,000', description: 'TDS threshold per year (₹)', category: 'tds' },
  { key: 'tds_section', value: '194J', description: 'TDS section', category: 'tds' },
  
  // Operational Terms
  { key: 'payout_day', value: '7', description: 'Day of month for payouts', category: 'operations' },
  { key: 'cancellation_notice_hours', value: '24', description: 'Hours notice for cancellation', category: 'operations' },
  { key: 'termination_notice_days', value: '30', description: 'Days notice for termination', category: 'operations' },
  { key: 'non_solicitation_months', value: '12', description: 'Non-solicitation period (months)', category: 'operations' },
  { key: 'liquidated_damages', value: '50,000', description: 'Liquidated damages amount (₹)', category: 'operations' },
  { key: 'liquidated_damages_multiplier', value: '5', description: 'LTV multiplier for damages', category: 'operations' },
  { key: 'no_show_wait_minutes', value: '15', description: 'Minutes to wait for no-show', category: 'operations' },
  { key: 'amendment_notice_days', value: '30', description: 'Days notice for amendments', category: 'operations' },
  
  // Program Details
  { key: 'program_fee', value: '5,999', description: 'Program fee (₹)', category: 'program' },
  { key: 'program_duration', value: '3 months', description: 'Program duration', category: 'program' },
  { key: 'sessions_per_month', value: '3', description: 'Sessions per month', category: 'program' },
  { key: 'session_duration', value: '45-60 minutes', description: 'Session duration', category: 'program' },
  
  // Agreement
  { key: 'agreement_version', value: '2.1', description: 'Current agreement version', category: 'agreement' },
];

const CATEGORY_INFO: { [key: string]: { label: string; icon: any; color: string } } = {
  company: { label: 'Company Details', icon: Building2, color: 'blue' },
  revenue: { label: 'Revenue Split', icon: Percent, color: 'green' },
  tds: { label: 'TDS & Tax', icon: IndianRupee, color: 'purple' },
  operations: { label: 'Operational Terms', icon: Clock, color: 'orange' },
  program: { label: 'Program Details', icon: FileSignature, color: 'pink' },
  agreement: { label: 'Agreement', icon: FileText, color: 'gray' },
};

export default function AdminAgreementsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'agreements' | 'variables'>('agreements');
  
  // Agreements state
  const [agreements, setAgreements] = useState<AgreementVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Variables state
  const [variables, setVariables] = useState<ConfigVariable[]>([]);
  const [variablesLoading, setVariablesLoading] = useState(false);
  const [savingVariables, setSavingVariables] = useState(false);
  const [editedVariables, setEditedVariables] = useState<{ [key: string]: string }>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadEntityType, setUploadEntityType] = useState('proprietorship');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data on load
  useEffect(() => {
    fetchAgreements();
    fetchVariables();
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
    } catch (err) {
      setError('Failed to fetch agreements');
    } finally {
      setLoading(false);
    }
  };

  const fetchVariables = async () => {
    setVariablesLoading(true);
    try {
      const { data, error } = await supabase
        .from('agreement_config')
        .select('key, value, description, category')
        .order('category');

      if (error) throw error;

      if (data && data.length > 0) {
        // Merge with defaults (in case some are missing)
        const mergedVariables = DEFAULT_VARIABLES.map(defaultVar => {
          const dbVar = data.find(d => d.key === defaultVar.key);
          return dbVar || defaultVar;
        });
        setVariables(mergedVariables);
        
        // Initialize edited values
        const edited: { [key: string]: string } = {};
        mergedVariables.forEach(v => { edited[v.key] = v.value; });
        setEditedVariables(edited);
      } else {
        // No data in DB, use defaults
        setVariables(DEFAULT_VARIABLES);
        const edited: { [key: string]: string } = {};
        DEFAULT_VARIABLES.forEach(v => { edited[v.key] = v.value; });
        setEditedVariables(edited);
      }
    } catch (err) {
      console.error('Error fetching variables:', err);
      // Use defaults on error
      setVariables(DEFAULT_VARIABLES);
      const edited: { [key: string]: string } = {};
      DEFAULT_VARIABLES.forEach(v => { edited[v.key] = v.value; });
      setEditedVariables(edited);
    } finally {
      setVariablesLoading(false);
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setEditedVariables(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveVariables = async () => {
    setSavingVariables(true);
    setError(null);

    try {
      // Prepare upsert data
      const upsertData = Object.entries(editedVariables).map(([key, value]) => {
        const varInfo = DEFAULT_VARIABLES.find(v => v.key === key);
        return {
          key,
          value,
          description: varInfo?.description || '',
          category: varInfo?.category || 'other',
        };
      });

      const { error: upsertError } = await supabase
        .from('agreement_config')
        .upsert(upsertData, { onConflict: 'key' });

      if (upsertError) throw upsertError;

      setSuccess('All variables saved successfully!');
      setHasChanges(false);
      fetchVariables();
    } catch (err: any) {
      console.error('Error saving variables:', err);
      setError(err.message || 'Failed to save variables');
    } finally {
      setSavingVariables(false);
    }
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
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Agreement uploaded successfully!');
        setShowUploadForm(false);
        resetUploadForm();
        fetchAgreements();
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadVersion('');
    setUploadTitle('');
    setUploadDescription('');
    setUploadEntityType('proprietorship');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        body: JSON.stringify({ action: 'activate' })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        fetchAgreements();
      } else {
        setError(data.error || 'Activation failed');
      }
    } catch (err) {
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
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        fetchAgreements();
      } else {
        setError(data.error || 'Deletion failed');
      }
    } catch (err) {
      setError('Deletion failed. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = async (agreement: AgreementVersion) => {
    setShowPreview(agreement.id);
    setPreviewLoading(true);
    setPreviewHtml('');

    try {
      const response = await fetch(`/api/agreement/active`);
      const data = await response.json();

      if (data.success) {
        setPreviewHtml(data.html);
      } else {
        setPreviewHtml(`<p class="text-red-500">Error: ${data.error}</p>`);
      }
    } catch (err) {
      setPreviewHtml('<p class="text-red-500">Failed to load preview</p>');
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group variables by category
  const groupedVariables = variables.reduce((acc, variable) => {
    const cat = variable.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(variable);
    return acc;
  }, {} as { [key: string]: ConfigVariable[] });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-purple-600" />
                  Agreement Management
                </h1>
                <p className="text-sm text-gray-500">Upload agreements & configure variables</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { fetchAgreements(); fetchVariables(); }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-gray-200 -mb-px">
            <button
              onClick={() => setActiveTab('agreements')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'agreements'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileSignature className="w-4 h-4 inline mr-2" />
              Agreement Documents
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'variables'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ==================== AGREEMENTS TAB ==================== */}
        {activeTab === 'agreements' && (
          <>
            {/* Upload Button */}
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowUploadForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload New Version
              </button>
            </div>

            {/* Upload Form Modal */}
            {showUploadForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Upload New Agreement</h2>
                    <button
                      onClick={() => { setShowUploadForm(false); resetUploadForm(); }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Agreement File (.docx) *
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition-colors">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".docx"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {uploadFile ? (
                          <div className="flex items-center justify-center gap-2 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <span>{uploadFile.name}</span>
                            <button
                              type="button"
                              onClick={() => { setUploadFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-gray-500 hover:text-purple-600"
                          >
                            <Upload className="w-8 h-8 mx-auto mb-2" />
                            <span>Click to select DOCX file</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Version Number *</label>
                      <input
                        type="text"
                        value={uploadVersion}
                        onChange={(e) => setUploadVersion(e.target.value)}
                        placeholder="e.g., 2.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                      <input
                        type="text"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="e.g., Coach Service Agreement v2.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                      <select
                        value={uploadEntityType}
                        onChange={(e) => setUploadEntityType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                      >
                        <option value="proprietorship">Proprietorship</option>
                        <option value="llp">LLP</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                      <textarea
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder="Notes about this version..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => { setShowUploadForm(false); resetUploadForm(); }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={uploading || !uploadFile || !uploadVersion || !uploadTitle}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {uploading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                        ) : (
                          <><Upload className="w-4 h-4" /> Upload</>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Preview Modal */}
            {showPreview && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-bold text-gray-900">Agreement Preview (with variables replaced)</h2>
                    <button
                      onClick={() => { setShowPreview(null); setPreviewHtml(''); }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {previewLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Agreements List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : agreements.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Agreements Uploaded</h3>
                <p className="text-gray-500 mb-4">Upload your first agreement to get started</p>
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Upload Agreement
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {agreements.map((agreement) => (
                  <div
                    key={agreement.id}
                    className={`bg-white rounded-xl border-2 p-6 transition-all ${
                      agreement.is_active
                        ? 'border-green-500 shadow-lg shadow-green-500/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{agreement.title}</h3>
                          {agreement.is_active && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              ACTIVE
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            v{agreement.version}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {agreement.entity_type}
                          </span>
                        </div>

                        {agreement.description && (
                          <p className="text-gray-600 text-sm mb-3">{agreement.description}</p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {agreement.file_name} ({formatFileSize(agreement.file_size_bytes)})
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Uploaded: {formatDate(agreement.created_at)}
                          </span>
                          {agreement.activated_at && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Check className="w-4 h-4" />
                              Activated: {formatDate(agreement.activated_at)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {agreement.total_signatures} signature{agreement.total_signatures !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <a
                          href={agreement.file_url}
                          download
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </a>

                        {agreement.is_active && (
                          <button
                            onClick={() => handlePreview(agreement)}
                            className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                            title="Preview"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        )}

                        {!agreement.is_active && (
                          <button
                            onClick={() => handleActivate(agreement.id)}
                            disabled={activating === agreement.id}
                            className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg disabled:opacity-50"
                            title="Activate"
                          >
                            {activating === agreement.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Check className="w-5 h-5" />
                            )}
                          </button>
                        )}

                        {!agreement.is_active && agreement.total_signatures === 0 && (
                          <button
                            onClick={() => handleDelete(agreement.id, agreement.version)}
                            disabled={deleting === agreement.id}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                            title="Delete"
                          >
                            {deleting === agreement.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== VARIABLES TAB ==================== */}
        {activeTab === 'variables' && (
          <>
            {/* Save Button */}
            <div className="mb-6 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Edit the values below. These will be used to fill <code className="bg-gray-100 px-1 rounded">{'{{variables}}'}</code> in the agreement.
              </p>
              <button
                onClick={saveVariables}
                disabled={savingVariables || !hasChanges}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  hasChanges
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-lg'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {savingVariables ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save All Changes</>
                )}
              </button>
            </div>

            {variablesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedVariables).map(([category, vars]) => {
                  const catInfo = CATEGORY_INFO[category] || { label: category, icon: Settings, color: 'gray' };
                  const IconComponent = catInfo.icon;
                  
                  return (
                    <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className={`px-6 py-4 bg-${catInfo.color}-50 border-b border-${catInfo.color}-100 flex items-center gap-3`}>
                        <IconComponent className={`w-5 h-5 text-${catInfo.color}-600`} />
                        <h3 className="font-semibold text-gray-900">{catInfo.label}</h3>
                        <span className="text-xs text-gray-500">({vars.length} variables)</span>
                      </div>
                      <div className="p-6 grid gap-4 sm:grid-cols-2">
                        {vars.map((variable) => (
                          <div key={variable.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {variable.description}
                              <code className="ml-2 text-xs text-purple-600 bg-purple-50 px-1 rounded">
                                {`{{${variable.key}}}`}
                              </code>
                            </label>
                            <input
                              type="text"
                              value={editedVariables[variable.key] || ''}
                              onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-900 mb-2">💡 How Variables Work</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Variables like <code className="bg-blue-100 px-1 rounded">{'{{company_name}}'}</code> in your DOCX will be replaced with values from this page</li>
                <li>• Changes take effect immediately for new coach signups</li>
                <li>• Already signed agreements are NOT affected by changes</li>
                <li>• Use the <strong>Preview</strong> button in Agreements tab to see the final result</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
