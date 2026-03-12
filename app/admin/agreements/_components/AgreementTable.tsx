'use client';

import {
  FileText,
  Check,
  Trash2,
  Eye,
  Download,
  Calendar,
  Users,
  Building2,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';

export interface AgreementVersion {
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

interface AgreementTableProps {
  agreements: AgreementVersion[];
  loading: boolean;
  activating: string | null;
  deleting: string | null;
  onShowUploadForm: () => void;
  onActivate: (id: string) => void;
  onDelete: (id: string, version: string) => void;
  onPreview: (agreement: AgreementVersion) => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AgreementTable({
  agreements,
  loading,
  activating,
  deleting,
  onShowUploadForm,
  onActivate,
  onDelete,
  onPreview,
}: AgreementTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" color="muted" />
      </div>
    );
  }

  if (agreements.length === 0) {
    return (
      <div className="bg-surface-1 rounded-xl border border-border py-8">
        <EmptyState
          icon={FileText}
          title="No Agreements Uploaded"
          description="Upload your first agreement to get started"
          action={{ label: 'Upload Agreement', onClick: onShowUploadForm }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {agreements.map((agreement) => (
        <div
          key={agreement.id}
          className={`bg-surface-1 rounded-xl border-2 p-6 transition-all ${
            agreement.is_active
              ? 'border-green-500 shadow-lg shadow-green-500/10'
              : 'border-border hover:border-border'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-bold text-white">{agreement.title}</h3>
                {agreement.is_active && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    ACTIVE
                  </span>
                )}
                <span className="px-2 py-0.5 bg-white/[0.08] text-gray-400 border border-white/[0.08] text-xs font-medium rounded-full">
                  v{agreement.version}
                </span>
                <span className="px-2 py-0.5 bg-surface-3 text-text-secondary text-xs font-medium rounded-full flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {agreement.entity_type}
                </span>
              </div>

              {agreement.description && (
                <p className="text-text-secondary text-sm mb-3">{agreement.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-text-tertiary">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {agreement.file_name} ({formatFileSize(agreement.file_size_bytes)})
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Uploaded: {formatDate(agreement.created_at)}
                </span>
                {agreement.activated_at && (
                  <span className="flex items-center gap-1 text-green-400">
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
                className="p-2 text-text-tertiary hover:text-text-secondary hover:bg-surface-3 rounded-lg"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>

              {agreement.is_active && (
                <button
                  onClick={() => onPreview(agreement)}
                  className="p-2 text-gray-300 hover:text-white hover:bg-white/[0.08] rounded-lg"
                  title="Preview"
                >
                  <Eye className="w-5 h-5" />
                </button>
              )}

              {!agreement.is_active && (
                <button
                  onClick={() => onActivate(agreement.id)}
                  disabled={activating === agreement.id}
                  className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg disabled:opacity-50"
                  title="Activate"
                >
                  {activating === agreement.id ? (
                    <Spinner />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              )}

              {!agreement.is_active && agreement.total_signatures === 0 && (
                <button
                  onClick={() => onDelete(agreement.id, agreement.version)}
                  disabled={deleting === agreement.id}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === agreement.id ? (
                    <Spinner />
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
  );
}
