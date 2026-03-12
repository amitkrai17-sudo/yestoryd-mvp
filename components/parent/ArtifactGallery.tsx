'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, XCircle,
  ChevronDown, X, Star, Upload, Eye,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface ArtifactSummary {
  id: string;
  artifact_type: string;
  title: string;
  thumbnail_uri: string | null;
  mime_type: string;
  analysis_status: string;
  content_type: string | null;
  skills_count: number;
  child_feedback_preview: string | null;
  parent_summary: string | null;
  upload_context: string;
  uploaded_by: string;
  created_at: string;
}

interface ArtifactDetail {
  id: string;
  artifact_type: string;
  title: string;
  original_url: string | null;
  processed_url: string | null;
  thumbnail_url: string | null;
  typed_text: string | null;
  analysis_status: string;
  analysis: {
    content_type: string;
    skills_demonstrated: string[];
    specific_observations: { skill: string; observation: string; quality: string }[];
    child_feedback: string;
    parent_summary: string;
    readability_score: number;
  } | null;
  coach_feedback: string | null;
  created_at: string;
}

interface ArtifactGalleryProps {
  childId: string;
  childName: string;
  refreshKey?: number; // Increment to trigger refresh
}

const PAGE_SIZE = 8;

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    case 'pending':
    case 'processing':
      return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    case 'unreadable':
      return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function QualityBadge({ quality }: { quality: string }) {
  const colors = {
    strength: 'bg-green-50 text-green-700 border-green-200',
    developing: 'bg-amber-50 text-amber-700 border-amber-200',
    needs_work: 'bg-red-50 text-red-700 border-red-200',
  };
  const labels = { strength: 'Strength', developing: 'Developing', needs_work: 'Needs Work' };
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${colors[quality as keyof typeof colors] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {labels[quality as keyof typeof labels] || quality}
    </span>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ArtifactGallery({ childId, childName, refreshKey }: ArtifactGalleryProps) {
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ArtifactDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchArtifacts = useCallback(async (offset = 0, append = false) => {
    try {
      const res = await fetch(`/api/artifacts/${childId}?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json();

      if (append) {
        setArtifacts(prev => [...prev, ...(data.artifacts || [])]);
      } else {
        setArtifacts(data.artifacts || []);
      }

      setTotal(data.total || 0);
      setHasMore((offset + PAGE_SIZE) < (data.total || 0));
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [childId]);

  useEffect(() => {
    setLoading(true);
    setArtifacts([]);
    fetchArtifacts(0);
  }, [childId, fetchArtifacts, refreshKey]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchArtifacts(artifacts.length, true);
  };

  const handleExpand = async (artifactId: string) => {
    if (expandedId === artifactId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }

    setExpandedId(artifactId);
    setLoadingDetail(true);

    try {
      const res = await fetch(`/api/artifacts/${childId}/${artifactId}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedDetail(data.artifact);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner color="muted" />
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Upload className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No work uploaded yet</p>
        <p className="text-xs text-gray-400 mt-1">Use the upload button above to share {childName}&apos;s work</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {artifacts.map((a) => (
          <button
            key={a.id}
            onClick={() => handleExpand(a.id)}
            className={`relative text-left rounded-xl border overflow-hidden transition-all active:scale-[0.98] ${
              expandedId === a.id
                ? 'ring-2 ring-[#FF0099]/40 border-[#FF0099]/30'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Thumbnail */}
            <div className="aspect-square bg-gray-100 relative">
              {a.thumbnail_uri ? (
                // Thumbnail loaded via signed URL from list data (not available directly)
                // Use a colored placeholder with type icon
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
                  <Eye className="w-8 h-8 text-[#FF0099]/30" />
                </div>
              ) : a.mime_type === 'text/plain' ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
                  <p className="text-[10px] text-gray-500 line-clamp-4 leading-tight">
                    {a.child_feedback_preview || 'Text submission'}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
                  <Eye className="w-8 h-8 text-[#FF0099]/30" />
                </div>
              )}

              {/* Status badge */}
              <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-sm">
                <StatusIcon status={a.analysis_status} />
              </div>
            </div>

            {/* Info */}
            <div className="p-2">
              <p className="text-xs font-medium text-gray-900 truncate">{a.title}</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-gray-400">{formatRelativeDate(a.created_at)}</p>
                {a.skills_count > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-[#FF0099]">
                    <Star className="w-2.5 h-2.5" />
                    {a.skills_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Expanded detail */}
      {expandedId && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : expandedDetail ? (
            <div className="p-4 space-y-4">
              {/* Close button */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 text-sm">{expandedDetail.title}</h4>
                <button onClick={() => { setExpandedId(null); setExpandedDetail(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Image / Text */}
              {expandedDetail.processed_url || expandedDetail.original_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={expandedDetail.processed_url || expandedDetail.original_url || ''}
                  alt={expandedDetail.title}
                  className="w-full rounded-xl border border-gray-200 max-h-64 object-contain bg-gray-50"
                />
              ) : expandedDetail.typed_text ? (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{expandedDetail.typed_text}</p>
                </div>
              ) : null}

              {/* Analysis results */}
              {expandedDetail.analysis && (
                <>
                  {/* Child feedback */}
                  <div className="bg-pink-50 rounded-xl p-3 border border-pink-100">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {expandedDetail.analysis.child_feedback}
                    </p>
                  </div>

                  {/* Parent summary */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Summary</p>
                    <p className="text-sm text-gray-700">{expandedDetail.analysis.parent_summary}</p>
                  </div>

                  {/* Skills */}
                  {expandedDetail.analysis.skills_demonstrated.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Skills Observed</p>
                      <div className="flex flex-wrap gap-1.5">
                        {expandedDetail.analysis.skills_demonstrated.map((skill) => (
                          <span key={skill} className="inline-flex items-center text-[11px] font-medium px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observations */}
                  {expandedDetail.analysis.specific_observations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Observations</p>
                      <div className="space-y-2">
                        {expandedDetail.analysis.specific_observations.map((obs, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <QualityBadge quality={obs.quality} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-800">{obs.skill}</p>
                              <p className="text-xs text-gray-600">{obs.observation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Coach feedback */}
              {expandedDetail.coach_feedback && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <p className="text-xs font-medium text-blue-600 mb-1">Coach Feedback</p>
                  <p className="text-sm text-gray-700">{expandedDetail.coach_feedback}</p>
                </div>
              )}

              {/* Pending analysis */}
              {(expandedDetail.analysis_status === 'pending' || expandedDetail.analysis_status === 'processing') && (
                <div className="flex items-center gap-2 py-2">
                  <Spinner size="sm" className="text-amber-500" />
                  <p className="text-sm text-gray-500">Analysis in progress...</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full flex items-center justify-center gap-2 h-10 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {loadingMore ? (
            <Spinner size="sm" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          {loadingMore ? 'Loading...' : `Show More (${total - artifacts.length} remaining)`}
        </button>
      )}
    </div>
  );
}
