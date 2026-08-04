import React, { useState, useEffect } from 'react';
import { 
  GitCompare, ArrowUpRight, ArrowDownRight, Minus, 
  CheckCircle2, AlertTriangle, Loader2, Sparkles 
} from 'lucide-react';
import axios from 'axios';

export default function AuditComparison() {
  const [audits, setAudits] = useState([]);
  const [prevId, setPrevId] = useState('');
  const [currId, setCurrId] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [expandedSection, setExpandedSection] = useState('new'); // 'new' | 'resolved'
  const [error, setError] = useState('');

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  useEffect(() => {
    fetchAuditList();
  }, []);

  const fetchAuditList = async () => {
    setLoadingList(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/history`);
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

    try {
      const res = await axios.get(`${BACKEND_URL}/audits/compare?prev_id=${prevId}&curr_id=${currId}`);
      setComparison(res.data);
    } catch (err) {
      console.error("Failed to compare audits:", err);
      setError(err.response?.data?.detail || "Comparison scan failed. Make sure backend uvicorn server was restarted.");
    } finally {
      setComparing(false);
    }
  };

  const isImproved = comparison?.score_difference > 0;
  const isRegressed = comparison?.score_difference < 0;

  return (
    <div className="bg-[#0f172a] text-slate-100 p-6 md:p-10 rounded-3xl border border-slate-800 shadow-2xl my-8">
      
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
                <span className="text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">+{comparison.new_violations_count} New</span>
                <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">-{comparison.resolved_violations_count} Fixed</span>
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

          {/* Expandable Lists */}
          <div className="bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex border-b border-slate-700">
              <button 
                onClick={() => setExpandedSection('new')}
                className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  expandedSection === 'new' ? 'bg-red-500/10 text-red-400 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> New Violations ({comparison.new_violations_count})
              </button>
              <button 
                onClick={() => setExpandedSection('resolved')}
                className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  expandedSection === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Resolved Violations ({comparison.resolved_violations_count})
              </button>
            </div>

            <div className="p-6">
              {expandedSection === 'new' && (
                comparison.new_violations.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">No new violations introduced in this audit!</p>
                ) : (
                  <div className="space-y-4">
                    {comparison.new_violations.map((v, i) => (
                      <div key={i} className="bg-[#0f172a] p-4 rounded-xl border border-red-500/20">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-red-400 text-sm">{v.rule_violated}</span>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">{v.severity}</span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800">{v.log_entry}</p>
                      </div>
                    ))}
                  </div>
                )
              )}

              {expandedSection === 'resolved' && (
                comparison.resolved_violations.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">No past violations were resolved in this scan.</p>
                ) : (
                  <div className="space-y-4">
                    {comparison.resolved_violations.map((v, i) => (
                      <div key={i} className="bg-[#0f172a] p-4 rounded-xl border border-emerald-500/20">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-emerald-400 text-sm">{v.rule_violated}</span>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Resolved</span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800">{v.log_entry}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}