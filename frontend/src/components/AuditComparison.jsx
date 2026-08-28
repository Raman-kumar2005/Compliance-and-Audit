import React, { useState, useEffect, useMemo } from 'react';
import { 
  GitCompare, ArrowUpRight, ArrowDownRight, Minus, 
  CheckCircle2, AlertTriangle, Loader2, Sparkles,
  Eye, User, Clock, ShieldAlert, ArrowRight, X, 
  Building, Check, HelpCircle, AlertCircle, FileText,
  FileSpreadsheet, Lock, ChevronDown, ChevronUp, UserCheck, Info
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';

const SENSITIVE_KEYS = [
  'salary', 'compensation', 'ssn', 'social_security', 'age', 
  'gender', 'race', 'ethnicity', 'marital_status', 'phone', 
  'contact', 'home_address', 'dob', 'date_of_birth'
];

function maskSensitiveValue(key, val) {
  if (!val) return '—';
  const lowerKey = String(key).toLowerCase();
  const isSensitive = SENSITIVE_KEYS.some(k => lowerKey.includes(k));
  if (isSensitive) {
    return '[MASKED FOR PRIVACY]';
  }
  return String(val);
}

function getScoreStatus(score) {
  if (score >= 80) {
    return {
      label: 'Compliant',
      colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      badgeDot: 'bg-emerald-400'
    };
  } else if (score >= 60) {
    return {
      label: 'Needs Attention',
      colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      badgeDot: 'bg-amber-400'
    };
  } else {
    return {
      label: 'Critical',
      colorClass: 'bg-red-500/10 text-red-400 border-red-500/30',
      badgeDot: 'bg-red-400'
    };
  }
}

const severityColors = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  High: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
};

export default function AuditComparison({ user }) {
  const [audits, setAudits] = useState([]);
  const [prevId, setPrevId] = useState('');
  const [currId, setCurrId] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [expandedSection, setExpandedSection] = useState('new'); // 'new' | 'changed' | 'resolved' | 'unchanged'
  const [expandedEvidence, setExpandedEvidence] = useState({}); // { [fingerprint]: boolean }
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [assigningViolation, setAssigningViolation] = useState(null);
  const [successToast, setSuccessToast] = useState('');
  const [error, setError] = useState('');

  // Local state copies to support owner assignment updates interactively
  const [localNewViolations, setLocalNewViolations] = useState([]);
  const [localResolvedViolations, setLocalResolvedViolations] = useState([]);
  const [localChangedViolations, setLocalChangedViolations] = useState([]);
  const [localUnchangedViolations, setLocalUnchangedViolations] = useState([]);

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  const authHeader = useMemo(() => {
    if (!user || !user.token) return {};
    return { Authorization: `Bearer ${user.token}` };
  }, [user]);

  // Keyboard Escape listener to dismiss modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedViolation(null);
        setAssigningViolation(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (user && user.token) {
      fetchAuditList();
    }
  }, [user]);

  useEffect(() => {
    if (comparison) {
      setLocalNewViolations(comparison.new_violations || []);
      setLocalResolvedViolations(comparison.resolved_violations || []);
      setLocalChangedViolations(comparison.changed_violations || []);
      setLocalUnchangedViolations(comparison.unchanged_violations || []);
    }
  }, [comparison]);

  const fetchAuditList = async () => {
    setLoadingList(true);
    setError('');
    try {
      const res = await axios.get(`${BACKEND_URL}/history`, { headers: authHeader });
      const data = Array.isArray(res.data) ? res.data : [];
      setAudits(data);
      if (data.length >= 2) {
        setCurrId(data[0].id); // Most recent scan
        setPrevId(data[1].id); // Second most recent scan
      } else if (data.length === 1) {
        setCurrId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch audit history:", err);
      setError("Failed to load audit history from server.");
    } finally {
      setLoadingList(false);
    }
  };

  const handleCompare = async () => {
    if (!prevId || !currId) {
      setError('Please select both a Previous Audit and a Current Audit to compare.');
      return;
    }
    if (prevId === currId) {
      setError('Please select two distinct audits (Previous and Current cannot be identical).');
      return;
    }

    setError('');
    setComparing(true);
    setComparison(null);

    try {
      const res = await axios.get(`${BACKEND_URL}/audits/compare?prev_id=${prevId}&curr_id=${currId}`, { headers: authHeader });
      setComparison(res.data);
    } catch (err) {
      console.error("Failed to compare audits:", err);
      setError(err.response?.data?.detail || "Comparison scan failed. Please select different audits or try again.");
    } finally {
      setComparing(false);
    }
  };

  const toggleEvidence = (fingerprint) => {
    setExpandedEvidence(prev => ({
      ...prev,
      [fingerprint]: !prev[fingerprint]
    }));
  };

  const handleAssignOwner = (v) => {
    setAssigningViolation(v);
  };

  const submitAssignOwner = (employeeId, employeeName) => {
    if (!assigningViolation) return;
    
    const updateList = (list) => 
      list.map(v => v.fingerprint === assigningViolation.fingerprint 
        ? { ...v, assigned_employee_id: employeeId, assigned_employee_name: employeeName } 
        : v
      );
      
    setLocalNewViolations(updateList);
    setLocalResolvedViolations(updateList);
    setLocalChangedViolations(updateList);
    setLocalUnchangedViolations(updateList);

    if (selectedViolation && selectedViolation.fingerprint === assigningViolation.fingerprint) {
      setSelectedViolation(prev => ({
        ...prev,
        assigned_employee_id: employeeId,
        assigned_employee_name: employeeName
      }));
    }

    setSuccessToast(`Successfully assigned owner to ${employeeName}`);
    setAssigningViolation(null);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const prevAuditRecord = useMemo(() => audits.find(a => a.id === prevId), [audits, prevId]);
  const currAuditRecord = useMemo(() => audits.find(a => a.id === currId), [audits, currId]);

  const prevScore = comparison?.previous_score ?? prevAuditRecord?.metrics?.compliance_score ?? null;
  const currScore = comparison?.current_score ?? currAuditRecord?.metrics?.compliance_score ?? null;
  const scoreDiff = comparison?.score_difference ?? (currScore !== null && prevScore !== null ? currScore - prevScore : 0);

  const isImproved = scoreDiff > 0;
  const isRegressed = scoreDiff < 0;

  const prevStatus = prevScore !== null ? getScoreStatus(prevScore) : null;
  const currStatus = currScore !== null ? getScoreStatus(currScore) : null;

  const prevCriticalCount = useMemo(() => {
    const list = prevAuditRecord?.violations || [];
    return list.filter(v => (v.severity || '').toUpperCase() === 'CRITICAL').length;
  }, [prevAuditRecord]);

  const currCriticalCount = useMemo(() => {
    const list = currAuditRecord?.violations || [];
    return list.filter(v => (v.severity || '').toUpperCase() === 'CRITICAL').length;
  }, [currAuditRecord]);

  return (
    <div className="bg-[#0f172a] text-slate-100 p-6 md:p-10 rounded-3xl border border-slate-800 shadow-2xl my-8 relative">
      
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-950 border border-emerald-500 text-emerald-300 rounded-xl shadow-2xl text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 1. Page Heading and Organization Context */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] bg-purple-500/15 text-purple-400 font-extrabold px-2.5 py-0.5 rounded border border-purple-500/25 uppercase tracking-wider">
              {user?.rawRole || user?.role || 'HR Compliance Officer'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Organization: <strong className="text-white font-bold">{user?.company_name || 'TechNova Technologies'}</strong>
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <GitCompare className="w-8 h-8 text-indigo-400" /> Compare Audits
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">Compare compliance performance and findings between two audit periods.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleCompare}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Audit Selection Sequence */}
      {audits.length < 2 ? (
        <div className="mb-8 p-6 bg-[#090d16] border border-slate-850 rounded-2xl text-center space-y-2">
          <Info className="w-8 h-8 text-indigo-400 mx-auto mb-1" />
          <h3 className="text-sm font-bold text-white">Not enough audit history</h3>
          <p className="text-xs text-slate-400">Run at least two audits to compare compliance over time.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Previous Audit Select */}
            <div className="bg-[#090d16] p-5 rounded-2xl border border-slate-800 space-y-2">
              <label className="block text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                Previous Audit
              </label>
              {loadingList ? (
                <div className="py-2.5 text-slate-400 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading audits...
                </div>
              ) : (
                <select 
                  value={prevId} 
                  onChange={(e) => setPrevId(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">Select Previous Audit...</option>
                  {audits.map((a) => {
                    const score = a.metrics?.compliance_score ?? a.compliance_score ?? 0;
                    const date = a.timestamp ? new Date(a.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown Date';
                    return (
                      <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                        {date} — {a.policy_filename || 'Corporate Policy'} (Score: {score}/100)
                      </option>
                    );
                  })}
                </select>
              )}
              <span className="text-[10px] text-slate-500 block">Baseline comparison audit period</span>
            </div>

            {/* Current Audit Select */}
            <div className="bg-[#090d16] p-5 rounded-2xl border border-slate-800 space-y-2">
              <label className="block text-xs font-extrabold uppercase text-indigo-400 tracking-wider">
                Current Audit
              </label>
              {loadingList ? (
                <div className="py-2.5 text-slate-400 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading audits...
                </div>
              ) : (
                <select 
                  value={currId} 
                  onChange={(e) => setCurrId(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">Select Current Audit...</option>
                  {audits.map((a) => {
                    const score = a.metrics?.compliance_score ?? a.compliance_score ?? 0;
                    const date = a.timestamp ? new Date(a.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown Date';
                    return (
                      <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                        {date} — {a.policy_filename || 'Corporate Policy'} (Score: {score}/100)
                      </option>
                    );
                  })}
                </select>
              )}
              <span className="text-[10px] text-slate-500 block">Target audit period evaluated against baseline</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompare}
            disabled={!prevId || !currId || comparing || prevId === currId}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {comparing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Comparing audits...</>
            ) : (
              <><GitCompare className="w-4 h-4" /> Compare Audits</>
            )}
          </button>
        </div>
      )}

      {/* Comparison Results Area */}
      {comparison ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* 3. Side-by-Side Comparison Summary */}
          <div className="bg-[#090d16] border border-slate-850 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Previous Audit Box */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Previous Audit</span>
                    <span className="text-xs text-slate-300 font-semibold mt-0.5 block">
                      {prevAuditRecord?.timestamp ? new Date(prevAuditRecord.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baseline'}
                    </span>
                  </div>
                  {prevStatus && (
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase", prevStatus.colorClass)}>
                      {prevStatus.label}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-4xl font-extrabold text-slate-200">
                    {comparison.previous_score} <span className="text-sm text-slate-500 font-bold">/ 100</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-medium">
                    <span>{prevAuditRecord?.violations?.length ?? '—'} violations</span>
                    <span>•</span>
                    <span className={prevCriticalCount > 0 ? "text-red-400 font-bold" : ""}>
                      {prevCriticalCount} critical
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Audit Box */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-indigo-500/30 flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">Current Audit</span>
                    <span className="text-xs text-white font-semibold mt-0.5 block">
                      {currAuditRecord?.timestamp ? new Date(currAuditRecord.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Target'}
                    </span>
                  </div>
                  {currStatus && (
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase", currStatus.colorClass)}>
                      {currStatus.label}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-4xl font-extrabold text-white">
                    {comparison.current_score} <span className="text-sm text-slate-500 font-bold">/ 100</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300 mt-2 font-medium">
                    <span>{currAuditRecord?.violations?.length ?? '—'} violations</span>
                    <span>•</span>
                    <span className={currCriticalCount > 0 ? "text-red-400 font-bold" : ""}>
                      {currCriticalCount} critical
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Score Delta & Status Pill */}
            <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Overall Change:</span>
                <span className={cn(
                  "text-xs font-extrabold flex items-center gap-1",
                  isImproved ? "text-emerald-400" : isRegressed ? "text-red-400" : "text-slate-300"
                )}>
                  {isImproved && <><ArrowUpRight className="w-4 h-4" /> Improvement: ↑ {comparison.score_difference} points (Status: Improved)</>}
                  {isRegressed && <><ArrowDownRight className="w-4 h-4" /> Regression: ↓ {Math.abs(comparison.score_difference)} points (Status: Regressed)</>}
                  {!isImproved && !isRegressed && <><Minus className="w-4 h-4" /> Stable: 0 points change</>}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Confidence: <strong className="text-slate-300">{comparison.risk_trend_confidence || 'High'}</strong>
              </span>
            </div>

            {/* AI Executive Summary Box */}
            {comparison.comparison_summary && (
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-300 block font-bold mb-0.5">AI Executive Summary</strong>
                  <p className="text-slate-300 leading-relaxed font-medium">{comparison.comparison_summary}</p>
                </div>
              </div>
            )}
          </div>

          {/* 4. Change Summary Cards (4 Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-red-400 tracking-wider">New Violations</span>
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-extrabold text-red-400 tracking-tight">+{comparison.new_violations_count}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Present only in current audit</span>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">Resolved Violations</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">-{comparison.resolved_violations_count}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Present previously, absent now</span>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">Changed Violations</span>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-extrabold text-amber-400 tracking-tight">+{comparison.changed_violations_count || 0}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Severity or status changed</span>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Unchanged</span>
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-extrabold text-slate-200 tracking-tight">{comparison.unchanged_violations_count || localUnchangedViolations.length}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">No meaningful change detected</span>
            </div>
          </div>

          {/* 5. 4 Interactive Tabs with Counts & Descriptions */}
          <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="flex flex-wrap border-b border-slate-800 bg-[#090d16]">
              <button 
                type="button"
                onClick={() => setExpandedSection('new')}
                className={cn(
                  "flex-1 min-w-[140px] py-4 px-3 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-b-2",
                  expandedSection === 'new' 
                    ? "bg-red-500/10 text-red-400 border-red-500" 
                    : "text-slate-400 hover:text-slate-200 border-transparent"
                )}
              >
                <span>New</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-300 font-bold">
                  {localNewViolations.length}
                </span>
              </button>
              
              <button 
                type="button"
                onClick={() => setExpandedSection('changed')}
                className={cn(
                  "flex-1 min-w-[140px] py-4 px-3 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-b-2",
                  expandedSection === 'changed' 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500" 
                    : "text-slate-400 hover:text-slate-200 border-transparent"
                )}
              >
                <span>Changed</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                  {localChangedViolations.length}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setExpandedSection('resolved')}
                className={cn(
                  "flex-1 min-w-[140px] py-4 px-3 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-b-2",
                  expandedSection === 'resolved' 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500" 
                    : "text-slate-400 hover:text-slate-200 border-transparent"
                )}
              >
                <span>Resolved</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                  {localResolvedViolations.length}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setExpandedSection('unchanged')}
                className={cn(
                  "flex-1 min-w-[140px] py-4 px-3 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-b-2",
                  expandedSection === 'unchanged' 
                    ? "bg-slate-800 text-slate-200 border-slate-400" 
                    : "text-slate-400 hover:text-slate-200 border-transparent"
                )}
              >
                <span>Unchanged</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-bold">
                  {localUnchangedViolations.length}
                </span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-6 md:p-8 space-y-6">
              
              {/* Tab Header Description */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  {expandedSection === 'new' && "Detected in the current audit and not found in the previous audit."}
                  {expandedSection === 'changed' && "Found in both audits, but severity, status, or meaningful evidence changed."}
                  {expandedSection === 'resolved' && "Found in the previous audit but absent from the current audit."}
                  {expandedSection === 'unchanged' && "Found in both audits with no meaningful change."}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {expandedSection === 'new' && `${localNewViolations.length} findings`}
                  {expandedSection === 'changed' && `${localChangedViolations.length} findings`}
                  {expandedSection === 'resolved' && `${localResolvedViolations.length} findings`}
                  {expandedSection === 'unchanged' && `${localUnchangedViolations.length} findings`}
                </span>
              </div>

              {/* NEW TAB CONTENT */}
              {expandedSection === 'new' && (
                localNewViolations.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400/40" />
                    <h4 className="text-sm font-bold text-white">No new violations</h4>
                    <p className="text-xs text-slate-400 max-w-sm">No new security anomalies or policy breaches were introduced since the last audit cycle.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5">
                    {localNewViolations.map((v, i) => (
                      <ViolationCard 
                        key={v.fingerprint || i} 
                        v={v} 
                        theme="new"
                        expandedEvidence={expandedEvidence}
                        toggleEvidence={toggleEvidence}
                        setSelectedViolation={setSelectedViolation}
                        handleAssignOwner={handleAssignOwner}
                      />
                    ))}
                  </div>
                )
              )}

              {/* CHANGED TAB CONTENT */}
              {expandedSection === 'changed' && (
                localChangedViolations.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                    <Minus className="w-10 h-10 text-slate-600" />
                    <h4 className="text-sm font-bold text-white">No changed violations</h4>
                    <p className="text-xs text-slate-400 max-w-sm">No existing findings changed between these audits.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5">
                    {localChangedViolations.map((v, i) => (
                      <ViolationCard 
                        key={v.fingerprint || i} 
                        v={v} 
                        theme="changed"
                        expandedEvidence={expandedEvidence}
                        toggleEvidence={toggleEvidence}
                        setSelectedViolation={setSelectedViolation}
                        handleAssignOwner={handleAssignOwner}
                      />
                    ))}
                  </div>
                )
              )}

              {/* RESOLVED TAB CONTENT */}
              {expandedSection === 'resolved' && (
                localResolvedViolations.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                    <AlertTriangle className="w-10 h-10 text-amber-500/40" />
                    <h4 className="text-sm font-bold text-white">Zero remediations found</h4>
                    <p className="text-xs text-slate-400 max-w-sm">No previously identified policy violations were resolved.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5">
                    {localResolvedViolations.map((v, i) => (
                      <ViolationCard 
                        key={v.fingerprint || i} 
                        v={v} 
                        theme="resolved"
                        expandedEvidence={expandedEvidence}
                        toggleEvidence={toggleEvidence}
                        setSelectedViolation={setSelectedViolation}
                        handleAssignOwner={handleAssignOwner}
                      />
                    ))}
                  </div>
                )
              )}

              {/* UNCHANGED TAB CONTENT */}
              {expandedSection === 'unchanged' && (
                localUnchangedViolations.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-slate-600" />
                    <h4 className="text-sm font-bold text-white">No unchanged findings</h4>
                    <p className="text-xs text-slate-400 max-w-sm">All findings had state changes or were newly detected.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5">
                    {localUnchangedViolations.map((v, i) => (
                      <ViolationCard 
                        key={v.fingerprint || i} 
                        v={v} 
                        theme="unchanged"
                        expandedEvidence={expandedEvidence}
                        toggleEvidence={toggleEvidence}
                        setSelectedViolation={setSelectedViolation}
                        handleAssignOwner={handleAssignOwner}
                      />
                    ))}
                  </div>
                )
              )}

            </div>
          </div>

        </div>
      ) : (
        /* Empty State before comparison */
        <div className="p-12 bg-[#090d16] border border-slate-850 rounded-3xl text-center space-y-3">
          <GitCompare className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white">Select audits to compare</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Choose a previous and current audit from the dropdown selectors above, then click <strong>Compare Audits</strong> to evaluate security changes over time.
          </p>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedViolation && (
        <DetailsModal 
          v={selectedViolation} 
          onClose={() => setSelectedViolation(null)} 
          handleAssignOwner={handleAssignOwner}
        />
      )}

      {/* ASSIGN OWNER SUB-MODAL */}
      {assigningViolation && (
        <AssignOwnerModal 
          v={assigningViolation} 
          onClose={() => setAssigningViolation(null)} 
          onSubmit={submitAssignOwner}
        />
      )}

    </div>
  );
}

// Subcomponent: Concise Violation Card
function ViolationCard({ 
  v, 
  theme, 
  expandedEvidence, 
  toggleEvidence, 
  setSelectedViolation, 
  handleAssignOwner 
}) {
  const isExpanded = !!expandedEvidence[v.fingerprint];

  const themeCardStyles = {
    new: 'border-l-4 border-l-red-500 bg-[#0f172a] border border-slate-800 hover:border-slate-700',
    changed: 'border-l-4 border-l-amber-500 bg-[#0f172a] border border-slate-800 hover:border-slate-700',
    resolved: 'border-l-4 border-l-emerald-500 bg-[#0f172a] border border-slate-800 hover:border-slate-700',
    unchanged: 'border-l-4 border-l-slate-600 bg-[#0f172a] border border-slate-800'
  };

  const themeLabelBadge = {
    new: 'bg-red-500/10 text-red-400 border border-red-500/30 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded',
    changed: 'bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded',
    resolved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded',
    unchanged: 'bg-slate-800 text-slate-300 border border-slate-700 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded'
  };

  return (
    <div className={cn("p-6 rounded-3xl shadow-xl transition-all space-y-4", themeCardStyles[theme])}>
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={themeLabelBadge[theme]}>{theme}</span>
            <span className={cn("text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase", severityColors[v.severity] || 'bg-slate-800 text-slate-300 border-slate-700')}>
              {v.severity}
            </span>
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-extrabold">
              {v.policy_category || 'Compliance'}
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-2 leading-snug">{v.rule_violated}</h3>
        </div>
        
        {v.sla && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border bg-slate-900 border-slate-850 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>SLA: {v.sla.sla_status} ({v.sla.sla_percent_elapsed}% elapsed)</span>
          </div>
        )}
      </div>

      {/* Scope Parameters Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#090d16] rounded-2xl border border-slate-850 text-xs font-semibold text-slate-400">
        <div>
          <span className="block text-[9px] uppercase font-bold text-slate-500">Department</span>
          <span className="text-slate-200 mt-0.5 flex items-center gap-1.5 font-semibold truncate">
            <Building className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" /> {v.department || 'Inferred'}
          </span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-slate-500">Assigned User</span>
          <span className="text-slate-200 mt-0.5 flex items-center gap-1.5 font-semibold truncate">
            <User className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" /> {v.assigned_employee_name || 'Ross'} ({v.assigned_employee_id || 'EMP-3430'})
          </span>
        </div>
        <div className="col-span-2">
          <span className="block text-[9px] uppercase font-bold text-slate-500">
            {theme === 'changed' ? 'Change Reason' : 'Scan Analysis'}
          </span>
          <span className="text-slate-300 mt-0.5 block font-medium truncate">
            {v.change_reason || v.explanation || 'No details provided.'}
          </span>
        </div>
      </div>

      {/* Changed Finding Side-by-Side Diff Presentation */}
      {theme === 'changed' && v.previous_state && (
        <div className="p-4 bg-[#090d16] border border-amber-500/20 rounded-2xl space-y-2.5">
          <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider block">
            State Modification Breakdown
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Previous State</span>
              <div className="flex justify-between text-slate-300">
                <span>Severity:</span>
                <span className="font-bold">{v.previous_state.severity || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Department:</span>
                <span className="font-bold">{v.previous_state.department || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Status:</span>
                <span className="font-bold uppercase">{v.previous_state.status || 'N/A'}</span>
              </div>
            </div>

            <div className="p-3 bg-[#0f172a] rounded-xl border border-amber-500/30 space-y-1.5">
              <span className="text-[9px] uppercase font-bold text-amber-400 block">Current State</span>
              <div className="flex justify-between text-slate-200">
                <span>Severity:</span>
                <span className={cn("font-bold", v.severity !== v.previous_state.severity ? "text-amber-400" : "")}>{v.severity}</span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Department:</span>
                <span className={cn("font-bold", v.department !== v.previous_state.department ? "text-amber-400" : "")}>{v.department}</span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Status:</span>
                <span className={cn("font-bold uppercase", v.status !== v.previous_state.status ? "text-amber-400" : "")}>{v.status}</span>
              </div>
            </div>
          </div>
          {v.change_reason && (
            <p className="text-xs text-amber-300/90 font-medium pt-1">
              <strong>Why it changed:</strong> {v.change_reason}
            </p>
          )}
        </div>
      )}

      {/* Recommended Action Summary */}
      <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl text-xs">
        <span className="font-extrabold text-indigo-400 block mb-0.5">Recommended Remediation:</span>
        <p className="text-slate-200 font-medium">{v.recommendation || 'Initiate standard remediation and verify policy compliance.'}</p>
      </div>

      {/* Collapsible Evidence Panel */}
      {isExpanded && (
        <div className="p-4 rounded-2xl bg-[#090d16] border border-slate-850 text-xs animate-in slide-in-from-top-2 duration-200 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 className="font-extrabold text-indigo-400 uppercase tracking-wider text-[10px]">Masked Evidence Log</h4>
            <span className="text-[9px] text-slate-500">Sensitive fields masked for privacy</span>
          </div>

          {v.sanitized_evidence ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 font-mono text-[11px]">
              {Object.entries(v.sanitized_evidence).map(([key, val]) => {
                const masked = maskSensitiveValue(key, val);
                return (
                  <div key={key} className="flex justify-between items-center border-b border-slate-850/60 py-1">
                    <span className="text-slate-500 font-semibold">{key}</span>
                    <span className={cn("truncate max-w-[220px]", masked === '[MASKED FOR PRIVACY]' ? "text-amber-400 font-bold" : "text-slate-200")}>
                      {masked}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-mono text-[11px] text-slate-300 bg-[#0f172a] p-3 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre">
              {v.log_entry || 'No raw log entry available.'}
            </p>
          )}
        </div>
      )}

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <button 
          type="button"
          onClick={() => toggleEvidence(v.fingerprint)}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          {isExpanded ? 'Hide Evidence' : 'View Evidence'}
        </button>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => handleAssignOwner(v)}
            className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <UserCheck className="w-3.5 h-3.5" /> Assign Owner
          </button>

          <button 
            type="button"
            onClick={() => setSelectedViolation(v)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-indigo-500/20"
          >
            <Eye className="w-3.5 h-3.5" /> View Details
          </button>
        </div>
      </div>

    </div>
  );
}

// Subcomponent: View Details Side-by-Side Modal
function DetailsModal({ v, onClose, handleAssignOwner }) {
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div 
        onClick={stopPropagation}
        className="w-full max-w-4xl bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-white my-8"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start p-6 bg-slate-900 border-b border-slate-850">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded border border-indigo-500/30 uppercase">
                {v.policy_category || 'Compliance'}
              </span>
              <span className={cn("text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase", severityColors[v.severity])}>
                {v.severity}
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-mono">
                Fingerprint: {v.fingerprint ? v.fingerprint.substring(0, 12) : 'N/A'}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-white leading-tight">{v.rule_violated}</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Side-by-Side comparison if previous state exists */}
          {v.previous_state ? (
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-amber-400" /> Comparison: Previous vs Current Audit State
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Previous Audit State */}
                <div className="p-4 rounded-2xl bg-[#090d16] border border-slate-800 text-xs space-y-2">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block mb-1">Baseline State (Previous)</span>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-400">Severity:</span>
                    <span className="text-slate-200 font-bold">{v.previous_state.severity || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-400">Department:</span>
                    <span className="text-slate-200 font-bold">{v.previous_state.department || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-slate-200 font-bold uppercase">{v.previous_state.status || 'N/A'}</span>
                  </div>
                </div>

                {/* Current Audit State */}
                <div className="p-4 rounded-2xl bg-[#090d16] border border-amber-500/30 text-xs space-y-2">
                  <span className="text-[9px] font-bold uppercase text-amber-400 block mb-1">Target State (Current)</span>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-400">Severity:</span>
                    <span className="text-white font-bold">{v.severity}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-400">Department:</span>
                    <span className="text-white font-bold">{v.department}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-white font-bold uppercase">{v.status}</span>
                  </div>
                </div>

              </div>
              {v.change_reason && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                  <span><strong>Reason for Audit Delta:</strong> {v.change_reason}</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h4 className="text-xs font-extrabold uppercase text-slate-400 mb-2 tracking-wider">Analysis Overview</h4>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {v.change_reason || v.explanation || 'No summary overview details are currently logged.'}
              </p>
            </div>
          )}

          {/* Exact Policy Rule */}
          <div className="p-4 bg-[#090d16] border border-slate-850 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" /> Compliance Policy Mandate
            </h4>
            <p className="text-xs text-white leading-relaxed font-bold">{v.rule_violated}</p>
            <p className="text-slate-400 text-xs leading-relaxed">{v.explanation}</p>
          </div>

          {/* Masked Evidence Grid */}
          {v.sanitized_evidence && (
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Masked Log Evidence</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#090d16] border border-slate-850 rounded-2xl font-mono text-[11px]">
                {Object.entries(v.sanitized_evidence).map(([key, val]) => {
                  const masked = maskSensitiveValue(key, val);
                  return (
                    <div key={key} className="flex justify-between items-center border-b border-slate-850/60 pb-1.5">
                      <span className="text-slate-500 font-semibold">{key}</span>
                      <span className={cn("truncate max-w-[220px]", masked === '[MASKED FOR PRIVACY]' ? "text-amber-400 font-bold" : "text-slate-200")}>
                        {masked}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended Remediation */}
          <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl space-y-1">
            <h4 className="text-xs font-extrabold uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Recommended Action
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed font-semibold">{v.recommendation || 'Initiate standard remediation.'}</p>
          </div>

          {/* Owner and SLA Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#090d16] border border-slate-850 text-xs">
              <span className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Ticket SLA Parameters</span>
              {v.sla ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Status:</span>
                    <span className="text-amber-400 font-bold uppercase">{v.sla.sla_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Time Elapsed:</span>
                    <span className="text-slate-200 font-bold">{v.sla.sla_percent_elapsed}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resolution Due:</span>
                    <span className="text-slate-200 font-bold font-mono">
                      {v.sla.resolution_due_at ? new Date(v.sla.resolution_due_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-slate-500 font-medium">No SLA deadlines active on this audit.</span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-[#090d16] border border-slate-850 text-xs flex flex-col justify-between">
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Ticket Assignment</span>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-200 font-bold">
                    {v.assigned_employee_name || 'Ross'} ({v.assigned_employee_id || 'EMP-3430'})
                  </span>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => handleAssignOwner(v)}
                className="mt-3 w-full py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Change Assignment
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-900 border-t border-slate-850 flex justify-end">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-all border border-slate-700"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Assign Owner Modal
function AssignOwnerModal({ v, onClose, onSubmit }) {
  const stopPropagation = (e) => e.stopPropagation();

  const isTechnova = v?.tenant_id === 'technova-demo' || v?.tenant_id === 'tenant-company-a';
  const isAegispoint = v?.tenant_id === 'aegispoint-demo' || v?.tenant_id === 'tenant-company-b';

  const employees = isTechnova ? [
    { id: 'EMP-TN-1042', name: 'Aarav Mehta', email: 'employee@technova-demo.com', dept: 'Engineering' },
    { id: 'EMP-TN-1047', name: 'Priya Sharma', email: 'priya@technova-demo.com', dept: 'Finance' },
    { id: 'EMP-TN-1051', name: 'Rohan Kapoor', email: 'rohan@technova-demo.com', dept: 'Human Resources' },
    { id: 'EMP-TN-1063', name: 'Ananya Singh', email: 'ananya@technova-demo.com', dept: 'Operations' },
    { id: 'EMP-TN-1078', name: 'Vikram Patel', email: 'vikram@technova-demo.com', dept: 'IT' }
  ] : isAegispoint ? [
    { id: 'EMP-AP-2011', name: 'Meera Nair', email: 'employee@aegispoint-demo.com', dept: 'Security Operations' },
    { id: 'EMP-AP-2016', name: 'Kabir Malhotra', email: 'kabir@aegispoint-demo.com', dept: 'Finance' },
    { id: 'EMP-AP-2024', name: 'Ishita Rao', email: 'ishita@aegispoint-demo.com', dept: 'People Operations' },
    { id: 'EMP-AP-2031', name: 'Dev Arora', email: 'dev@aegispoint-demo.com', dept: 'Client Services' },
    { id: 'EMP-AP-2040', name: 'Neha Iyer', email: 'neha@aegispoint-demo.com', dept: 'Technology' }
  ] : [
    { id: 'EMP-3430', name: 'Ross Ross', email: 'employee.ross@security-hq.com', dept: 'IT Ops' }
  ];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#020617]/90 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div 
        onClick={stopPropagation}
        className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-white"
      >
        <div className="flex justify-between items-center p-5 bg-slate-900 border-b border-slate-850">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-400" /> Assign Security Owner
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-slate-400 mb-4 font-medium">Select a team member to assign ownership for the violation ticket:</p>
          <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
            {employees.map(emp => (
              <button
                type="button"
                key={emp.id}
                onClick={() => onSubmit(emp.id, emp.name)}
                className="w-full p-3 rounded-2xl bg-[#090d16] hover:bg-indigo-500/10 border border-slate-850 hover:border-indigo-500/30 text-left transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-indigo-400 transition-colors">{emp.name}</span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors font-mono mt-0.5 block">
                    ID: {emp.id} — {emp.dept} Dept
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-850 flex justify-end">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}