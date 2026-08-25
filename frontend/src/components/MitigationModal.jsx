import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, ShieldAlert, AlertTriangle, Users, FileText, 
  Lock, Zap, Info, Loader2, Link as LinkIcon, Edit3, 
  CheckCircle2, AlertOctagon, HelpCircle, GitCommit, FileCheck2, Send, Clock
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import SLAStatusIndicator from './SLAStatusIndicator';

const BACKEND_URL = 'http://127.0.0.1:8000/api';

const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/i;

function renderSlaBadgeInModal(sla, now = new Date()) {
  if (!sla) return null;
  
  const status = sla.sla_status || 'ON_TRACK';
  const percent = sla.sla_percent_elapsed || 0;
  const isPaused = status === 'PAUSED';
  const isResolved = status === 'RESOLVED';
  
  let resDue = null;
  if (sla.resolution_due_at) {
    try {
      const cleaned = sla.resolution_due_at.endsWith('Z') ? sla.resolution_due_at : sla.resolution_due_at + 'Z';
      resDue = new Date(cleaned);
    } catch (e) {}
  }

  let timeText = '';
  let isOverdue = false;
  if (resDue && !isResolved && !isPaused) {
    const diffMs = resDue.getTime() - now.getTime();
    if (diffMs <= 0) {
      isOverdue = true;
      const overdueHrs = Math.max(1, Math.ceil(Math.abs(diffMs) / (3600 * 1000)));
      timeText = `${overdueHrs}h overdue`;
    } else {
      const hrs = Math.floor(diffMs / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / 60000);
      if (hrs > 24) {
        timeText = `${Math.floor(hrs / 24)}d left`;
      } else if (hrs > 0) {
        timeText = `${hrs}h left`;
      } else {
        timeText = `${mins}m left`;
      }
    }
  }

  // Determine colors (styled nicely for dark theme)
  let colorStyle = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
  let text = `On Track${timeText ? ` · ${timeText}` : ''}`;

  if (sla.escalation_level > 0 || status === 'ESCALATED') {
    colorStyle = 'bg-purple-500/10 border-purple-500/25 text-purple-400';
    text = 'Escalated · Lead notified';
  } else if (status === 'BREACHED' || status === 'ACKNOWLEDGMENT_OVERDUE' || isOverdue) {
    colorStyle = 'bg-red-500/10 border-red-500/25 text-red-400';
    text = `Breached${timeText ? ` · ${timeText}` : ' · Overdue'}`;
  } else if (status === 'WARNING_80' || percent >= 80) {
    colorStyle = 'bg-orange-500/10 border-orange-500/25 text-orange-400';
    text = `Warning · ${Math.round(percent)}% SLA used`;
  } else if (status === 'WARNING_50' || percent >= 50) {
    colorStyle = 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400';
    text = `Near Breach${timeText ? ` · ${timeText}` : ''}`;
  } else if (isPaused) {
    colorStyle = 'bg-blue-500/10 border-blue-500/25 text-blue-400';
    text = 'Paused';
  } else if (isResolved) {
    colorStyle = 'bg-emerald-600/10 border-emerald-600/25 text-emerald-450';
    text = 'Resolved';
  }

  return (
    <span className={`px-2 py-0.5 rounded border text-[9px] font-extrabold tracking-wider uppercase ${colorStyle}`}>
      {text}
    </span>
  );
}

export default function MitigationModal({ 
  violation: initialViolation, 
  user,
  onClose, 
  onStatusChanged 
}) {
  const [violation, setViolation] = useState(initialViolation);
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [escalations, setEscalations] = useState([]);
  const [slaActionLoading, setSlaActionLoading] = useState(false);
  const [manualEscalateComment, setManualEscalateComment] = useState('');
  const [showManualEscalateInput, setShowManualEscalateInput] = useState(false);
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceType, setEvidenceType] = useState('URL'); // 'URL' | 'RECEIPT'
  const [reviewerComment, setReviewerComment] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showConfirm, setShowConfirm] = useState(null); // null | 'APPROVE' | 'REJECT' | 'START'

  const authHeader = useMemo(() => {
    if (!user || !user.token) return {};
    return { Authorization: `Bearer ${user.token}` };
  }, [user]);

  // Load activities and fresh violation details
  const loadData = async () => {
    if (!violation?.id) return;
    setActivityLoading(true);
    try {
      const resVio = await axios.get(`${BACKEND_URL}/violations/${violation.id}`, { headers: authHeader });
      setViolation(resVio.data);
      
      const resAct = await axios.get(`${BACKEND_URL}/violations/${violation.id}/activity`, { headers: authHeader });
      setActivities(resAct.data);

      const resEsc = await axios.get(`${BACKEND_URL}/violations/${violation.id}/escalations`, { headers: authHeader });
      setEscalations(resEsc.data);
    } catch (err) {
      console.error("Failed to sync modal data:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleAcknowledgeSla = async () => {
    setSlaActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await axios.post(`${BACKEND_URL}/hr/violations/${violation.id}/acknowledge`, {}, { headers: authHeader });
      setSuccessMsg("Violation SLA acknowledged successfully.");
      loadData();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error(err);
      setError("Failed to acknowledge violation SLA.");
    } finally {
      setSlaActionLoading(false);
    }
  };

  const handlePauseSla = async () => {
    setSlaActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await axios.post(`${BACKEND_URL}/hr/violations/${violation.id}/pause-sla`, {}, { headers: authHeader });
      setSuccessMsg("SLA paused successfully.");
      loadData();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error(err);
      setError("Failed to pause SLA.");
    } finally {
      setSlaActionLoading(false);
    }
  };

  const handleResumeSla = async () => {
    setSlaActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await axios.post(`${BACKEND_URL}/hr/violations/${violation.id}/resume-sla`, {}, { headers: authHeader });
      setSuccessMsg("SLA resumed successfully.");
      loadData();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error(err);
      setError("Failed to resume SLA.");
    } finally {
      setSlaActionLoading(false);
    }
  };

  const handleManualEscalate = async () => {
    if (!manualEscalateComment.trim()) {
      setError("Please enter a comment for manual escalation.");
      return;
    }
    setSlaActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await axios.post(
        `${BACKEND_URL}/hr/violations/${violation.id}/manual-escalate`, 
        { comment: manualEscalateComment }, 
        { headers: authHeader }
      );
      setSuccessMsg("Violation escalated successfully.");
      setManualEscalateComment('');
      setShowManualEscalateInput(false);
      loadData();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error(err);
      setError("Failed to manually escalate violation.");
    } finally {
      setSlaActionLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Reset forms
    setNotes('');
    setEvidenceUrl('');
    setEvidenceTitle('');
    setReviewerComment('');
    setError('');
    setSuccessMsg('');
  }, [initialViolation?.id]);

  // Close on Escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Determine Severity styling properties
  const severityStyle = useMemo(() => {
    const sev = (violation?.severity || 'Medium').toUpperCase();
    if (sev === 'CRITICAL') {
      return {
        badge: 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.12)]',
        label: 'Critical Threat',
        Icon: ShieldAlert
      };
    } else if (sev === 'HIGH') {
      return {
        badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.12)]',
        label: 'High Severity',
        Icon: ShieldAlert
      };
    } else if (sev === 'MEDIUM') {
      return {
        badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        label: 'Medium Flag',
        Icon: AlertTriangle
      };
    } else {
      return {
        badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        label: 'Low Deviation',
        Icon: Info
      };
    }
  }, [violation]);

  const statusStyle = useMemo(() => {
    const stat = (violation?.status || 'OPEN').toUpperCase();
    const map = {
      OPEN: 'bg-red-500/15 border-red-500/30 text-red-400',
      IN_PROGRESS: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      PENDING_VERIFICATION: 'bg-orange-500/15 border-orange-500/30 text-orange-400 animate-pulse',
      RESOLVED: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      REQUIRES_CHANGES: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
      REOPENED: 'bg-rose-500/15 border-rose-500/30 text-rose-400'
    };
    return map[stat] || 'bg-slate-500/15 border-slate-500/30 text-slate-400';
  }, [violation]);

  // Form submit validators
  const isSubmitDisabled = useMemo(() => {
    if (!evidenceTitle.trim() || !notes.trim() || !evidenceUrl.trim()) return true;
    if (evidenceType === 'URL' && !URL_REGEX.test(evidenceUrl.trim())) return true;
    return false;
  }, [evidenceUrl, evidenceTitle, evidenceType, notes]);

  const handleStartMitigation = async () => {
    setError('');
    setSubmitting(true);
    try {
      await axios.patch(`${BACKEND_URL}/violations/${violation.id}/start-mitigation`, {}, { headers: authHeader });
      setSuccessMsg('Remediation initialized successfully.');
      loadData();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start mitigation process.');
    } finally {
      setSubmitting(false);
      setShowConfirm(null);
    }
  };

  const handleSubmitVerification = async (e) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    setError('');
    setSubmitting(true);
    try {
      await axios.post(
        `${BACKEND_URL}/violations/${violation.id}/submit-verification`,
        {
          mitigation_evidence_url: evidenceUrl.trim(),
          mitigation_evidence_title: evidenceTitle.trim(),
          employee_mitigation_notes: notes.trim()
        },
        { headers: authHeader }
      );
      setSuccessMsg('Evidence submitted for verification. Status is now PENDING_VERIFICATION.');
      loadData();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHRReview = async (action) => {
    setError('');
    setSubmitting(true);
    try {
      await axios.post(
        `${BACKEND_URL}/violations/${violation.id}/review`,
        {
          action,
          comment: reviewerComment.trim() || undefined
        },
        { headers: authHeader }
      );
      setSuccessMsg(`Violation status updated to ${action === 'APPROVE' ? 'RESOLVED' : 'REQUIRES_CHANGES'}.`);
      loadData();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to complete review.');
    } finally {
      setSubmitting(false);
      setShowConfirm(null);
    }
  };

  if (!violation) return null;

  const isEmployee = user?.role === 'Employee';
  const isHR = user?.role === 'HR';

  return (
    <div 
      className="fixed inset-0 bg-[#020617]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget && !showConfirm) onClose();
      }}
    >
      {/* Modal Card Container */}
      <div className="relative bg-[#090d16] border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300 text-white">
        
        {/* Glow corner accent */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

        {/* Modal Header */}
        <div className="bg-[#0c1224] border-b border-slate-800/80 px-6 py-5 flex justify-between items-center relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase">
                Registry ID: {violation.id}
              </span>
              <span className="text-slate-600">•</span>
              <span className={cn(
                "px-2 py-0.5 rounded border text-[9px] font-extrabold tracking-wider uppercase",
                statusStyle
              )}>
                {violation.status.replace('_', ' ')}
              </span>
              {violation.sla && (
                <>
                  <span className="text-slate-600">•</span>
                  {renderSlaBadgeInModal(violation.sla)}
                </>
              )}
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight mt-1">AI Compliance Remediation Center</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto relative z-10 flex-1 custom-scrollbar">
          {/* Success / Error Messages */}
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SLA countdown indicator */}
          {violation.sla && (
            <div className="space-y-4">
              <SLAStatusIndicator sla={violation.sla} severity={violation.severity} />
              
              {/* HR-only SLA Controls */}
              {isHR && (
                <div className="bg-[#1e293b]/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <span className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Auditor SLA Action Dashboard</span>
                  <div className="flex flex-wrap gap-2.5">
                    {/* Acknowledge Button */}
                    {!violation.sla.acknowledged_at && (
                      <button
                        onClick={handleAcknowledgeSla}
                        disabled={slaActionLoading}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 font-sans"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Acknowledge SLA
                      </button>
                    )}

                    {/* Pause / Resume Button */}
                    {violation.sla.sla_status === 'PAUSED' ? (
                      <button
                        onClick={handleResumeSla}
                        disabled={slaActionLoading}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/25 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 font-sans"
                      >
                        <Clock className="w-4 h-4" /> Resume SLA
                      </button>
                    ) : (
                      <button
                        onClick={handlePauseSla}
                        disabled={slaActionLoading}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 font-sans"
                      >
                        <Clock className="w-4 h-4" /> Pause SLA
                      </button>
                    )}

                    {/* Manual Escalate Button */}
                    <button
                      onClick={() => setShowManualEscalateInput(!showManualEscalateInput)}
                      disabled={slaActionLoading}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 border border-purple-500/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 font-sans"
                    >
                      <Send className="w-4 h-4" /> Manual Escalate
                    </button>
                  </div>

                  {showManualEscalateInput && (
                    <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                      <label className="block text-xs font-semibold text-slate-350">Escalation Routing Notes</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Comment for manual escalation to Dept Lead..."
                          value={manualEscalateComment}
                          onChange={(e) => setManualEscalateComment(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-300 font-semibold"
                        />
                        <button
                          onClick={handleManualEscalate}
                          disabled={slaActionLoading}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Route
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Details Row: Employee, Dept, Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0f172a]/30 border border-slate-800/60 p-4 rounded-2xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Assigned Owner</span>
                <span className="text-xs font-bold text-slate-300">{violation.assigned_employee_name || 'Ross Security'}</span>
              </div>
            </div>
            
            <div className="bg-[#0f172a]/30 border border-slate-800/60 p-4 rounded-2xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Boundary Zone</span>
                <span className="text-xs font-bold text-slate-300">{violation.department || 'IT'}</span>
              </div>
            </div>

            <div className="bg-[#0f172a]/30 border border-slate-800/60 p-4 rounded-2xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-red-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Due Date</span>
                <span className="text-xs font-bold text-slate-300">{violation.due_date || '2026-08-24'}</span>
              </div>
            </div>
          </div>

          {/* 1. Policy Control Rule (Clause) */}
          <div className="bg-[#0f172a]/20 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">1. Policy Control Clause</span>
              <span className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase border tracking-wider",
                severityStyle.badge
              )}>
                <severityStyle.Icon className="w-3 h-3" />
                {severityStyle.label}
              </span>
            </div>
            <h4 className="text-xs md:text-sm font-extrabold text-white leading-snug">
              {violation.rule_violated || 'Unknown Policy Directive'}
            </h4>
          </div>

          {/* 2. Log Evidence (Sanitized Grid) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">2. Log Evidence</span>
              <span className="text-[8px] text-amber-500 font-extrabold uppercase font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Masked for Privacy</span>
            </div>
            {violation.sanitized_evidence ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#030712] border border-slate-850 rounded-2xl font-mono text-[10px]">
                {Object.entries(violation.sanitized_evidence).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center border-b border-slate-850/60 pb-1">
                    <span className="text-slate-500 font-semibold">{key}</span>
                    <span className={cn(
                      "truncate max-w-[200px] font-medium",
                      val === '[MASKED FOR PRIVACY]' ? "text-amber-500" : "text-slate-350"
                    )}>
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-[#030712] border border-slate-850 text-slate-500 text-xs italic text-center rounded-2xl">
                Evidence unavailable
              </div>
            )}
          </div>

          {/* 3. Detected Violation (Explanation) & 4. Risk Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0f172a]/30 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-2">3. Detected Violation</span>
                <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                  {violation.explanation}
                </p>
              </div>
            </div>

            <div className="bg-[#0f172a]/30 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-2">4. Risk Assessment & Severity Reasoning</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Compliance evaluation classified this incident as <strong className={cn("font-extrabold uppercase", severityStyle.badge.includes('red') ? 'text-red-400' : 'text-amber-450')}>{violation.severity || 'Medium'}</strong>. This severity assessment is derived dynamically based on breach proximity to access control boundaries, PII visibility risks, and organizational policy constraints.
                </p>
              </div>
            </div>
          </div>

          {/* 5. Recommendation (Mitigation advice) */}
          <div className="p-5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl">
            <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider block mb-2">5. Recommended Next Action</span>
            <p className="text-xs text-indigo-200 leading-relaxed font-semibold">
              {violation.recommendation}
            </p>
          </div>

          {/* Submitted Evidence View (If exits) */}
          {(violation.mitigation_evidence_url || violation.reviewer_comments) && (
            <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-4">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block border-b border-slate-800 pb-2">Active Remediation Evidence</span>
              
              {violation.mitigation_evidence_url && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Submitted Evidence Reference:</span>
                    <div className="flex items-center gap-1.5 text-indigo-400 font-semibold truncate">
                      <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <a 
                        href={violation.mitigation_evidence_url.startsWith('http') ? violation.mitigation_evidence_url : '#'} 
                        target="_blank" 
                        rel="noreferrer"
                        className="hover:underline truncate"
                      >
                        {violation.mitigation_evidence_title || 'View Evidence Link'}
                      </a>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Employee Mitigation Note:</span>
                    <p className="text-slate-300 italic">"{violation.employee_mitigation_notes}"</p>
                  </div>
                </div>
              )}

              {violation.reviewer_comments && (
                <div className="text-xs bg-purple-500/5 border border-purple-500/10 p-3 rounded-xl">
                  <span className="text-purple-400 font-bold block mb-1">HR Compliance Auditor Feedback:</span>
                  <p className="text-slate-300">"{violation.reviewer_comments}"</p>
                </div>
              )}
            </div>
          )}

          {/* INTERACTION SECTION: Employee Start/Submit Form */}
          {isEmployee && (
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              {violation.status === 'OPEN' && (
                <div className="bg-indigo-950/20 border border-indigo-900/30 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <h5 className="text-xs font-bold text-white">Remediation Status is Open</h5>
                    <p className="text-[11px] text-slate-400 mt-1">Acknowledge this flag and start tracking remediation process.</p>
                  </div>
                  <button
                    onClick={handleStartMitigation}
                    disabled={submitting}
                    className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
                    Initialize Remediation
                  </button>
                </div>
              )}

              {(violation.status === 'IN_PROGRESS' || violation.status === 'REQUIRES_CHANGES' || violation.status === 'REOPENED') && (
                <form onSubmit={handleSubmitVerification} className="space-y-4">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Submit Mitigation Evidence</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">Evidence Type</label>
                      <select
                        value={evidenceType}
                        onChange={(e) => {
                          setEvidenceType(e.target.value);
                          setEvidenceUrl('');
                        }}
                        className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold text-xs text-slate-200"
                      >
                        <option value="URL">Secure Link (URL)</option>
                        <option value="RECEIPT">Receipt / Hash Ref</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">
                        {evidenceType === 'URL' ? 'Evidence Link URL' : 'Receipt ID / Hash'}
                      </label>
                      <input 
                        type="text"
                        placeholder={evidenceType === 'URL' ? 'https://github.com/org/repo/pull/123' : 'REV-897123'}
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2.5 outline-none text-xs focus:ring-2 focus:ring-indigo-500 text-slate-200 placeholder-slate-650"
                      />
                      {evidenceType === 'URL' && evidenceUrl.trim() && !URL_REGEX.test(evidenceUrl.trim()) && (
                        <span className="text-[10px] text-red-400 font-semibold block mt-1">Please enter a valid URL (http/https).</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">Evidence Reference Title</label>
                    <input 
                      type="text"
                      placeholder="e.g., Secure Patch PR #124, Token Revocation Receipt"
                      value={evidenceTitle}
                      onChange={(e) => setEvidenceTitle(e.target.value)}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2.5 outline-none text-xs focus:ring-2 focus:ring-indigo-500 text-slate-200 placeholder-slate-650"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">Remediation / Mitigation Notes</label>
                    <textarea 
                      rows="3"
                      placeholder="Explain how this issue has been resolved. Document access rotations, firewalls, or policy read acknowledgements..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl p-4 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 placeholder-slate-600 leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submitting || isSubmitDisabled}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/25 cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Submit for HR Verification
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* INTERACTION SECTION: HR Actions & Comment Form */}
          {isHR && (
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              {violation.status === 'PENDING_VERIFICATION' && (
                <div className="space-y-4">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Auditor Verification Review</span>
                  
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">Compliance Reviewer Feedback Comments</label>
                    <textarea 
                      rows="3"
                      placeholder="Provide verification notes. Required if requesting changes or rejection."
                      value={reviewerComment}
                      onChange={(e) => setReviewerComment(e.target.value)}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl p-4 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 placeholder-slate-600 leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        if (!reviewerComment.trim()) {
                          setError('Reviewer comment feedback is required to request changes.');
                          return;
                        }
                        setError('');
                        setShowConfirm('REJECT');
                      }}
                      disabled={submitting}
                      className="bg-purple-600 hover:bg-purple-750 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
                    >
                      Request Changes
                    </button>

                    <button
                      onClick={() => {
                        setError('');
                        setShowConfirm('APPROVE');
                      }}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Resolve
                    </button>
                  </div>
                </div>
              )}

              {violation.status === 'RESOLVED' && (
                <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-2xl flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <h5 className="text-xs font-bold text-emerald-400">Violation Mitigated & Resolved</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">This issue was verified as resolved by {violation.verified_by}.</p>
                  </div>
                  <button
                    onClick={() => setShowConfirm('REOPEN')}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Reopen Issue
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Violation activity timeline */}
          <div className="border-t border-slate-800/80 pt-6">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-4">Remediation Action Timeline</span>
            
            {activityLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Syncing timeline events...
              </div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No activity logs recorded for this violation.</p>
            ) : (
              <div className="relative border-l border-slate-800 ml-2 pl-6 space-y-5">
                {activities.map((act) => {
                  const dateStr = act.created_at ? new Date(act.created_at).toLocaleString() : 'Pending';
                  
                  return (
                    <div key={act.activity_id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1 bg-[#090d16] border-2 border-indigo-500/50 p-1.5 rounded-full z-10">
                        <GitCommit className="w-2.5 h-2.5 text-indigo-400" />
                      </span>
                      
                      <div className="text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-200">{act.actor_name}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1 py-0.2 rounded font-extrabold uppercase">{act.actor_role}</span>
                          <span className="text-slate-500 font-semibold">•</span>
                          <span className="text-indigo-400 font-semibold">{act.action.replace('_', ' ')}</span>
                          <span className="text-slate-500 font-semibold">•</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{dateStr}</span>
                        </div>
                        
                        {act.comment && (
                          <p className="text-slate-400 mt-1 pl-2.5 border-l-2 border-slate-800 italic">
                            "{act.comment}"
                          </p>
                        )}

                        {act.evidence_url && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-400 font-semibold hover:underline">
                            <LinkIcon className="w-3 h-3" />
                            <a href={act.evidence_url.startsWith('http') ? act.evidence_url : '#'} target="_blank" rel="noreferrer">
                              Evidence Attachment
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Escalation & SLA Timeline */}
          {['CRITICAL', 'HIGH'].includes((violation?.severity || '').toUpperCase()) && (
            <div className="border-t border-slate-800/80 pt-6">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-4">Escalation & SLA Timeline</span>
              {escalations.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-slate-400">No escalation events logged yet.</p>
              ) : (
                <div className="relative border-l border-slate-800 ml-2 pl-6 space-y-4">
                  {escalations.map((esc, index) => {
                    const dateStr = esc.created_at ? new Date(esc.created_at).toLocaleString() : 'Pending';
                    return (
                      <div key={esc.notification_id || index} className="relative animate-in fade-in duration-300">
                        {/* Timeline dot */}
                        <span className="absolute -left-[31px] top-1 bg-[#090d16] border-2 border-amber-500/50 p-1.5 rounded-full z-10">
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                        </span>
                        <div className="text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-amber-450">{esc.event_type.replace(/_/g, ' ')}</span>
                            <span className="text-slate-500 font-semibold">•</span>
                            <span className="text-slate-350 font-bold">{esc.recipient_name} ({esc.recipient_email})</span>
                            <span className="text-slate-500 font-semibold">•</span>
                            <span className="text-[10px] text-slate-500 font-semibold">{dateStr}</span>
                          </div>
                          <p className="text-slate-400 mt-1 pl-2.5 border-l-2 border-slate-850 italic">
                            {esc.message}
                          </p>
                          <div className="text-[9px] text-slate-550 mt-0.5">
                            Channel: {esc.channel} • Status: {esc.status}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#0c1224] border-t border-slate-800/80 px-6 py-4 flex justify-end gap-3 relative z-10">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Dynamic Nested Confirmation Dialog Modal */}
        {showConfirm && (
          <div className="absolute inset-0 bg-[#020617]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0b0f19] border border-slate-800 max-w-sm w-full p-6 rounded-2xl shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-amber-400">
                <HelpCircle className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">Confirm Lifecycle Change</h4>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                {showConfirm === 'APPROVE' && 'Are you sure you want to verify the evidence and resolve this violation? Status will set to RESOLVED.'}
                {showConfirm === 'REJECT' && 'Are you sure you want to reject the evidence? The status will update to REQUIRES_CHANGES.'}
                {showConfirm === 'REOPEN' && 'Are you sure you want to reopen this resolved violation?'}
              </p>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (showConfirm === 'APPROVE') handleHRReview('APPROVE');
                    else if (showConfirm === 'REJECT') handleHRReview('REJECT');
                    else if (showConfirm === 'REOPEN') handleHRReview('REOPEN');
                  }}
                  className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg cursor-pointer"
                >
                  Confirm Change
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
