import React, { useState, useEffect, useMemo } from 'react';
import { 
  GitCompare, ArrowUpRight, ArrowDownRight, Minus, 
  CheckCircle2, AlertTriangle, Loader2, Sparkles,
  Eye, User, Clock, ShieldAlert, ArrowRight, X, 
  Building, Check, HelpCircle, AlertCircle, FileText
} from 'lucide-react';
import axios from 'axios';

export default function AuditComparison({ user }) {
  const [audits, setAudits] = useState([]);
  const [prevId, setPrevId] = useState('');
  const [currId, setCurrId] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [expandedSection, setExpandedSection] = useState('new'); // 'new' | 'resolved' | 'changed'
  const [expandedEvidence, setExpandedEvidence] = useState({}); // { [fingerprint]: boolean }
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [assigningViolation, setAssigningViolation] = useState(null);
  const [successToast, setSuccessToast] = useState('');
  const [error, setError] = useState('');

  // Local state copy to support owner assignment updates interactively
  const [localNewViolations, setLocalNewViolations] = useState([]);
  const [localResolvedViolations, setLocalResolvedViolations] = useState([]);
  const [localChangedViolations, setLocalChangedViolations] = useState([]);

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  const authHeader = useMemo(() => {
    if (!user || !user.token) return {};
    return { Authorization: `Bearer ${user.token}` };
  }, [user]);

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
    }
  }, [comparison]);

  const fetchAuditList = async () => {
    setLoadingList(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/history`, { headers: authHeader });
      setAudits(res.data);
      if (res.data.length >= 2) {
        setCurrId(res.data[0].id); // Most recent scan
        setPrevId(res.data[1].id); // Second most recent scan
      } else if (res.data.length === 1) {
        setCurrId(res.data[0].id);
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
      setError('Please select two distinct audits to compare.');
      return;
    }
    if (prevId === currId) {
      setError('Please select two different audits (Baseline and Target cannot be identical).');
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
      setError(err.response?.data?.detail || "Comparison scan failed. Make sure backend uvicorn server was restarted.");
    } finally {
      setComparing(false);
    }
  };

  const toggleEvidence = (fingerprint) => {
    setExpandedEvidence(prev => ({
      ...prev,
      [fingerprint] : !prev[fingerprint]
    }));
  };

  const handleAssignOwner = (v) => {
    setAssigningViolation(v);
  };

  const submitAssignOwner = (employeeId, employeeName) => {
    if (!assigningViolation) return;
    
    // Update local state arrays
    const updateList = (list) => 
      list.map(v => v.fingerprint === assigningViolation.fingerprint 
        ? { ...v, assigned_employee_id: employeeId, assigned_employee_name: employeeName } 
        : v
      );
      
    setLocalNewViolations(updateList);
    setLocalResolvedViolations(updateList);
    setLocalChangedViolations(updateList);

    // Also update current details modal if open
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

  const isImproved = comparison?.score_difference > 0;
  const isRegressed = comparison?.score_difference < 0;

  // Custom styling map for severities
  const severityColors = {
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    High: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };

  return (
    <div className="bg-[#0f172a] text-slate-100 p-6 md:p-10 rounded-3xl border border-slate-800 shadow-2xl my-8 relative">
      
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-950 border border-emerald-500 text-emerald-300 rounded-xl shadow-2xl text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <GitCompare className="w-8 h-8 text-indigo-400" /> Audit Delta & Comparison
          </h2>
          <p className="text-slate-400 text-sm mt-1">Select two audit scans to evaluate security posture changes over time.</p>
        </div>
        <span className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-500/30">
          Hackathon Demo Tool
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Baseline Select */}
        <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700">
          <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Baseline (Previous Audit)</label>
          {loadingList ? (
            <div className="py-3 text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading scans...</div>
          ) : (
            <select 
              value={prevId} 
              onChange={(e) => setPrevId(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 px-4 py-3 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="">Select Previous Audit...</option>
              {audits.map((a) => {
                const score = a.metrics?.compliance_score ?? a.compliance_score ?? 0;
                return (
                  <option key={a.id} value={a.id}>
                    {new Date(a.timestamp).toLocaleDateString()} — {a.policy_filename || 'Policy'} (Score: {score})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Target Select */}
        <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700">
          <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Target (Current Audit)</label>
          {loadingList ? (
            <div className="py-3 text-slate-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading scans...</div>
          ) : (
            <select 
              value={currId} 
              onChange={(e) => setCurrId(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 px-4 py-3 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="">Select Current Audit...</option>
              {audits.map((a) => {
                const score = a.metrics?.compliance_score ?? a.compliance_score ?? 0;
                return (
                  <option key={a.id} value={a.id}>
                    {new Date(a.timestamp).toLocaleDateString()} — {a.policy_filename || 'Policy'} (Score: {score})
                  </option>
                );
              })}
            </select>
          )}
        </div>

      </div>

      <button
        onClick={handleCompare}
        disabled={!prevId || !currId || comparing}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mb-10"
      >
        {comparing ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitCompare className="w-5 h-5" />}
        Run Comparison Scan
      </button>

      {/* Comparison Results Area */}
      {comparison && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* AI Summary Banner */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 p-6 rounded-2xl flex items-start gap-4 shadow-lg">
            <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-indigo-200 mb-1">AI Executive Summary</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{comparison.comparison_summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold">
                <span className="text-slate-400">Trend Confidence: <strong className="text-emerald-400">{comparison.risk_trend_confidence}</strong></span>
                <span className="text-slate-400">Overall Status: <strong className={isImproved ? "text-emerald-400" : isRegressed ? "text-red-400" : "text-amber-400"}>{comparison.overall_risk_change}</strong></span>
              </div>
            </div>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/80 shadow-md">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-2">Previous Score</span>
              <span className="text-4xl font-extrabold text-slate-200">{comparison.previous_score}</span>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/80 shadow-md">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-2">Current Score</span>
              <span className="text-4xl font-extrabold text-white">{comparison.current_score}</span>
            </div>

            <div className={`p-6 rounded-2xl border shadow-md ${
              isImproved ? 'bg-emerald-950/20 border-emerald-500/40' : isRegressed ? 'bg-red-950/20 border-red-500/40' : 'bg-slate-800 border-slate-700'
            }`}>
              <span className="text-xs font-bold uppercase text-slate-400 block mb-2">Score Delta</span>
              <div className="flex items-center gap-2">
                {isImproved && <ArrowUpRight className="w-8 h-8 text-emerald-400" />}
                {isRegressed && <ArrowDownRight className="w-8 h-8 text-red-400" />}
                {!isImproved && !isRegressed && <Minus className="w-8 h-8 text-slate-400" />}
                <span className={`text-4xl font-extrabold ${isImproved ? 'text-emerald-400' : isRegressed ? 'text-red-400' : 'text-slate-200'}`}>
                  {comparison.score_difference > 0 ? `+${comparison.score_difference}` : comparison.score_difference}
                </span>
              </div>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/80 shadow-md">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-2">Violation Changes</span>
              <div className="flex items-center gap-3 text-sm font-bold mt-2">
                <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">+{comparison.new_violations_count} New</span>
                <span className="text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">+{comparison.changed_violations_count || 0} Chg</span>
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">-{comparison.resolved_violations_count} Fixed</span>
              </div>
            </div>

          </div>

          {/* Department Breakdown Delta */}
          <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700">
            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Department Violation Delta</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {Object.entries(comparison.department_breakdown_difference || {}).map(([dept, diff]) => (
                <div key={dept} className="bg-[#0f172a] p-3.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-xs font-semibold text-slate-400 block">{dept}</span>
                  <span className={`text-lg font-bold ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tab Selection Navigation */}
          <div className="bg-[#1e293b] rounded-3xl border border-slate-850 overflow-hidden">
            <div className="flex border-b border-slate-800 bg-slate-900/40">
              <button 
                onClick={() => setExpandedSection('new')}
                className={`flex-1 py-4 font-bold text-xs md:text-sm flex flex-col md:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  expandedSection === 'new' ? 'bg-red-500/15 text-red-400 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>New Violations</span>
                </div>
                <span className="text-[10px] md:text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{comparison.new_violations_count}</span>
              </button>
              
              <button 
                onClick={() => setExpandedSection('changed')}
                className={`flex-1 py-4 font-bold text-xs md:text-sm flex flex-col md:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  expandedSection === 'changed' ? 'bg-orange-500/15 text-orange-400 border-b-2 border-orange-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  <span>Changed Violations</span>
                </div>
                <span className="text-[10px] md:text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">{comparison.changed_violations_count || 0}</span>
              </button>

              <button 
                onClick={() => setExpandedSection('resolved')}
                className={`flex-1 py-4 font-bold text-xs md:text-sm flex flex-col md:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  expandedSection === 'resolved' ? 'bg-emerald-500/15 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resolved Violations</span>
                </div>
                <span className="text-[10px] md:text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">{comparison.resolved_violations_count}</span>
              </button>
            </div>

            {/* List Cards Body */}
            <div className="p-6">
              
              {/* Tab Header Badge Helper */}
              <div className="mb-6 flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {expandedSection === 'new' && "NEW — Detected in current audit"}
                  {expandedSection === 'changed' && "CHANGED — Existing violation changed in severity or evidence"}
                  {expandedSection === 'resolved' && "RESOLVED — Absent from current audit"}
                </span>
                <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
                  {expandedSection === 'new' && `${localNewViolations.length} Items`}
                  {expandedSection === 'changed' && `${localChangedViolations.length} Items`}
                  {expandedSection === 'resolved' && `${localResolvedViolations.length} Items`}
                </span>
              </div>

              {/* NEW TAB */}
              {expandedSection === 'new' && (
                localNewViolations.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mb-3" />
                    <h4 className="text-sm font-bold text-slate-300">Clean Scan Results</h4>
                    <p className="text-slate-500 text-xs mt-1 max-w-sm">No new security anomalies or policy breaches were introduced since the last audit cycle.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {localNewViolations.map((v, i) => (
                      <ViolationCard 
                        key={v.fingerprint || i} 
                        v={v} 
                        theme="new"
                        severityColors={severityColors}
                        expandedEvidence={expandedEvidence}
                        toggleEvidence={toggleEvidence}
                        setSelectedViolation={setSelectedViolation}
                        handleAssignOwner={handleAssignOwner}
                      />
                    ))}
                  </div>
                )
              )}

              {/* CHANGED TAB */}
              {expandedSection === 'changed' && (
                localChangedViolations.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center">
                    <Minus className="w-12 h-12 text-slate-500/20 mb-3" />
                    <h4 className="text-sm font-bold text-slate-300">No Changed Violations</h4>
                    <p className="text-slate-500 text-xs mt-1 max-w-sm">No existing tickets registered modifications in department assignments, severities, or resolution states.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {localChangedViolations.map((v, i) => (
                      <ViolationCard 
                        key={v.fingerprint || i} 
                        v={v} 
                        theme="changed"
                        severityColors={severityColors}
                        expandedEvidence={expandedEvidence}
                        toggleEvidence={toggleEvidence}
                        setSelectedViolation={setSelectedViolation}
                        handleAssignOwner={handleAssignOwner}
                      />
                    ))}
                  </div>
                )
              )}

              {/* RESOLVED TAB */}
              {expandedSection === 'resolved' && (
                localResolvedViolations.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500/20 mb-3" />
                    <h4 className="text-sm font-bold text-slate-300">Zero Remediations Found</h4>
                    <p className="text-slate-500 text-xs mt-1 max-w-sm">No previously identified policy violations were resolved. Retest unresolved tickets in target logs.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {localResolvedViolations.map((v, i) => (
                      <ViolationCard 
                        key={v.fingerprint || i} 
                        v={v} 
                        theme="resolved"
                        severityColors={severityColors}
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
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedViolation && (
        <DetailsModal 
          v={selectedViolation} 
          onClose={() => setSelectedViolation(null)} 
          severityColors={severityColors}
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

// Subcomponent: Violation Card
function ViolationCard({ 
  v, 
  theme, 
  severityColors, 
  expandedEvidence, 
  toggleEvidence, 
  setSelectedViolation, 
  handleAssignOwner 
}) {
  const isExpanded = !!expandedEvidence[v.fingerprint];

  // Theme styling configurations
  const themeCardStyles = {
    new: 'border-l-4 border-l-red-500 bg-[#1e293b]/70 border border-slate-700/60 shadow-lg hover:border-slate-650 transition-all',
    changed: 'border-l-4 border-l-orange-500 bg-[#1e293b]/70 border border-slate-700/60 shadow-lg hover:border-slate-650 transition-all',
    resolved: 'border-l-4 border-l-emerald-500 bg-[#1e293b]/40 border border-slate-800/80 opacity-90'
  };

  const themeLabelBadge = {
    new: 'bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded',
    changed: 'bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded',
    resolved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded'
  };

  return (
    <div className={`p-6 rounded-2xl ${themeCardStyles[theme]}`}>
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 pb-3 border-b border-slate-850">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={themeLabelBadge[theme]}>{theme}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityColors[v.severity] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
              {v.severity}
            </span>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 px-2 py-0.5 rounded font-extrabold">
              {v.policy_category || 'Compliance'}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-white mt-2 leading-snug">{v.rule_violated}</h3>
        </div>
        
        {/* SLA Status Badge if present */}
        {v.sla && (
          <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
            v.sla.sla_status === 'ESCALATED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
            v.sla.sla_status === 'WARNING_80' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            <span>SLA: {v.sla.sla_status} ({v.sla.sla_percent_elapsed}% elapsed)</span>
          </div>
        )}
      </div>

      {/* Scope Parameters Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-3 bg-slate-900/30 rounded-xl border border-slate-800/40 text-xs font-semibold text-slate-400">
        <div>
          <span className="block text-[9px] uppercase font-bold text-slate-500">Department</span>
          <span className="text-slate-200 mt-0.5 block flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-400" /> {v.department || 'Inferred'}
          </span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-slate-500">Assigned User</span>
          <span className="text-slate-200 mt-0.5 block flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-purple-400" /> {v.assigned_employee_name || 'Ross'} (ID: {v.assigned_employee_id || 'EMP-3430'})
          </span>
        </div>
        <div className="col-span-2">
          <span className="block text-[9px] uppercase font-bold text-slate-500">
            {theme === 'changed' ? 'Change Breakdown' : 'Scan Analysis'}
          </span>
          <span className="text-slate-300 mt-0.5 block font-medium truncate">
            {v.change_reason || v.explanation || 'No details provided.'}
          </span>
        </div>
      </div>

      {/* Recommended Action Summary */}
      <div className="p-3 bg-indigo-950/20 border border-indigo-500/10 rounded-xl text-xs mb-4">
        <span className="font-extrabold text-indigo-400 block mb-1">Recommended Remediation:</span>
        <p className="text-slate-300 font-medium">{v.recommendation}</p>
      </div>

      {/* Collapsible Evidence Panel */}
      {isExpanded && v.sanitized_evidence && (
        <div className="mb-4 p-4 rounded-xl bg-slate-950 border border-slate-850 text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-900">
            <h4 className="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">Evidence Log Metadata</h4>
            <span className="text-[9px] text-slate-500">Sensitive fields have been masked</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 font-mono">
            {Object.entries(v.sanitized_evidence).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center border-b border-slate-900/50 py-1">
                <span className="text-slate-500 text-[11px] font-semibold">{key}</span>
                <span className={`text-[11px] truncate max-w-[200px] md:max-w-[300px] font-medium ${val === '[MASKED FOR PRIVACY]' ? "text-amber-500" : "text-slate-300"}`}>
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={() => toggleEvidence(v.fingerprint)}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-850 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          {isExpanded ? 'Hide Evidence' : 'View Evidence'}
        </button>

        <button 
          onClick={() => setSelectedViolation(v)}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
          View Details
        </button>

        <button 
          onClick={() => handleAssignOwner(v)}
          className="px-3.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 border border-purple-500/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <User className="w-3.5 h-3.5" />
          Assign Owner
        </button>
      </div>

    </div>
  );
}

// Subcomponent: View Details Side-by-Side Modal
function DetailsModal({ v, onClose, severityColors, handleAssignOwner }) {
  // Prevent clicks from closing modal
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div 
        onClick={stopPropagation}
        className="w-full max-w-4xl bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start p-6 bg-slate-900 border-b border-slate-850">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded border border-indigo-500/30 uppercase">
                {v.policy_category || 'Compliance'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityColors[v.severity]}`}>
                {v.severity}
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-mono">
                Fingerprint: {v.fingerprint ? v.fingerprint.substring(0, 12) : 'N/A'}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-white leading-tight">{v.rule_violated}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Scrollable Grid */}
        <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Side-by-Side comparison if previous state exists */}
          {v.previous_state ? (
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-orange-400" /> Comparison (Previous vs Current Audit State)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Previous Audit State */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
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
                  <div>
                    <span className="text-slate-500 text-[10px] font-semibold block mb-1">Raw Evidence Log:</span>
                    <p className="font-mono text-[10px] text-slate-400 p-2 rounded bg-slate-950 border border-slate-850 overflow-x-auto whitespace-pre">
                      {v.previous_state.log_entry || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Current Audit State */}
                <div className="p-4 rounded-2xl bg-orange-950/10 border border-orange-500/20 text-xs space-y-2">
                  <span className="text-[9px] font-bold uppercase text-orange-400 block mb-1">Target State (Current)</span>
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
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block mb-1">Sanitized Current Evidence:</span>
                    <p className="font-mono text-[10px] text-slate-300 p-2 rounded bg-slate-950 border border-slate-850 overflow-x-auto whitespace-pre">
                      {v.log_entry}
                    </p>
                  </div>
                </div>

              </div>
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span><strong>Reason for Audit Delta:</strong> {v.change_reason}</span>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">Analysis Overview</h4>
              <p className="text-sm text-slate-300 font-medium">{v.change_reason || v.explanation || 'No summary overview details are currently logged.'}</p>
            </div>
          )}

          {/* Exact Policy Rule */}
          <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl">
            <h4 className="text-xs font-extrabold uppercase text-slate-400 mb-2 tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" /> Compliance Policy Mandate
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">{v.rule_violated}</p>
            <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{v.explanation}</p>
          </div>

          {/* Sanitized Evidence Grid */}
          {v.sanitized_evidence && (
            <div>
              <h4 className="text-xs font-extrabold uppercase text-slate-400 mb-3 tracking-wider">Masked Log Evidence Grid</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-950 border border-slate-850 rounded-2xl font-mono text-[11px]">
                {Object.entries(v.sanitized_evidence).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center border-b border-slate-900/60 pb-1.5">
                    <span className="text-slate-500 font-semibold">{key}</span>
                    <span className={`truncate max-w-[220px] ${val === '[MASKED FOR PRIVACY]' ? 'text-amber-500' : 'text-slate-300'}`}>
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Remediation */}
          <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl">
            <h4 className="text-xs font-extrabold uppercase text-indigo-400 mb-2 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" /> AI Recommended Remediation
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed font-semibold">{v.recommendation}</p>
          </div>

          {/* Owner and SLA Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-850 text-xs">
              <span className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Ticket SLA Parameters</span>
              {v.sla ? (
                <div className="space-y-2">
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

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-850 text-xs flex flex-col justify-between">
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-500 mb-1.5">Ticket Assignment</span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-200 font-bold">
                    {v.assigned_employee_name || 'Ross'} (ID: {v.assigned_employee_id || 'EMP-3430'})
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => handleAssignOwner(v)}
                className="mt-3 w-full py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 border border-purple-500/20 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <User className="w-3.5 h-3.5" />
                Change Assignment
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-900/60 border-t border-slate-850 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-all border border-slate-800"
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

  // Simulated list of enterprise employees
  const employees = [
    { id: 'EMP-3430', name: 'Ross Ross', email: 'employee.ross@security-hq.com', dept: 'IT' },
    { id: 'EMP-A-01', name: 'Bob Smith', email: 'employee.bob@company-a.com', dept: 'IT' },
    { id: 'EMP-B-01', name: 'David Jones', email: 'employee.david@company-b.com', dept: 'Sales' },
    { id: 'EMP-1002', name: 'Alice HR', email: 'hr.alice@company-a.com', dept: 'HR' },
    { id: 'EMP-1003', name: 'Charlie HR', email: 'hr.charlie@company-b.com', dept: 'HR' }
  ];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#020617]/90 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div 
        onClick={stopPropagation}
        className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-5 bg-slate-900 border-b border-slate-850">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-purple-400" /> Assign Security Owner
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-slate-400 mb-4 font-medium">Select a team member to assign ownership for the violation ticket:</p>
          <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => onSubmit(emp.id, emp.name)}
                className="w-full p-3 rounded-2xl bg-slate-900 hover:bg-indigo-500/10 border border-slate-850 hover:border-indigo-500/30 text-left transition-all flex items-center justify-between group cursor-pointer"
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

        <div className="p-4 bg-slate-900/40 border-t border-slate-850 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}