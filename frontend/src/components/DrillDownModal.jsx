import React, { useEffect, useMemo } from 'react';
import { 
  X, ShieldAlert, AlertTriangle, Users, FileText, 
  Lock, Zap, Info, Loader2, PlayCircle, Clock
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function DrillDownModal({ 
  violation, 
  onClose, 
  mitigationStatus, 
  setMitigationStatus, 
  mitigationNotes, 
  setMitigationNotes, 
  onSave, 
  saving 
}) {
  
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
        label: 'Critical Priority Threat',
        Icon: ShieldAlert
      };
    } else if (sev === 'HIGH') {
      return {
        badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.12)]',
        label: 'High Severity Violation',
        Icon: ShieldAlert
      };
    } else if (sev === 'MEDIUM') {
      return {
        badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        label: 'Medium Severity Flag',
        Icon: AlertTriangle
      };
    } else {
      return {
        badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        label: 'Low Severity Deviation',
        Icon: Info
      };
    }
  }, [violation]);

  if (!violation) return null;

  return (
    <div 
      className="fixed inset-0 bg-[#020617]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Container Card */}
      <div className="relative bg-[#090d16] border border-slate-800/80 rounded-3xl max-w-2xl w-full shadow-[0_0_50px_rgba(99,102,241,0.15)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 text-white">
        
        {/* Glow highlight backdrop */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="bg-[#0c1224] border-b border-slate-800/80 px-6 py-5 flex justify-between items-center relative z-10">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase block mb-1">
              Violation Registry ID: #{violation.id}
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">Audit Findings & Mitigation Details</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto relative z-10">
          
          {/* Metadata Cards: Employee & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0f172a]/40 border border-slate-800/60 p-3.5 rounded-2xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Affected Employee</span>
                <span className="text-sm font-semibold text-slate-200">{violation.employee || 'Unknown'}</span>
              </div>
            </div>
            
            <div className="bg-[#0f172a]/40 border border-slate-800/60 p-3.5 rounded-2xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                <Lock className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Department Boundary</span>
                <span className="text-sm font-semibold text-slate-200">{violation.department || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Severity & Policy Section */}
          <div className="bg-[#0f172a]/30 border border-slate-800/80 p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Company Policy Violated</span>
              
              <span className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border tracking-wider",
                severityStyle.badge
              )}>
                <severityStyle.Icon className="w-3.5 h-3.5" />
                {severityStyle.label}
              </span>
            </div>
            <h4 className="text-base font-extrabold text-white leading-snug">
              {violation.rule_violated || 'Unknown Corporate Rule'}
            </h4>
          </div>

          {/* System Log Evidence */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">System Log Evidence (Raw File Data)</span>
            <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-[#030712] p-4">
              <pre className="font-mono text-cyan-400 text-xs whitespace-pre-wrap break-all max-h-36 overflow-y-auto pr-2">
                {violation.log_entry}
              </pre>
            </div>
          </div>

          {/* AI Insights & Recommended Next Step */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Explanation */}
            <div className="bg-[#0f172a]/30 border border-slate-800/80 p-5 rounded-2xl space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block mb-2">AI Incident Explanation</span>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
                  {violation.explanation}
                </p>
              </div>
              <span className="text-[9px] font-semibold text-slate-500 mt-4 flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-500" /> Automated audit inference
              </span>
            </div>

            {/* Recommendation */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-2xl space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-wider block mb-2">Required Next Action</span>
                <p className="text-xs md:text-sm text-indigo-200 leading-relaxed font-bold">
                  {violation.recommendation}
                </p>
              </div>
              <span className="text-[9px] font-semibold text-indigo-400/80 mt-4 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400 animate-pulse" /> Urgent mitigation steps
              </span>
            </div>
          </div>

          {/* Resolution Workflow */}
          <div className="border-t border-slate-800/80 pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Auditor Review Workflow & Logs</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Auditor Status</label>
                <select
                  value={mitigationStatus}
                  onChange={(e) => setMitigationStatus(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold text-xs text-slate-200"
                >
                  <option value="OPEN">🔴 Open / Unresolved</option>
                  <option value="IN_PROGRESS">🟡 In Progress</option>
                  <option value="MITIGATED">🟢 Mitigated / Resolved</option>
                  <option value="FALSE_POSITIVE">⚪ False Positive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Mitigation Log Notes</label>
              <textarea
                rows="3"
                value={mitigationNotes}
                onChange={(e) => setMitigationNotes(e.target.value)}
                placeholder="Document safety retakes, patch levels, or auditor decisions regarding this policy violation..."
                className="w-full bg-[#0f172a] border border-slate-800 rounded-xl p-4 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 placeholder-slate-500 leading-relaxed"
              />
            </div>
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="bg-[#0c1224] border-t border-slate-800/80 px-6 py-4 flex justify-end gap-3 relative z-10">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          
          <button 
            onClick={onSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...</>
            ) : (
              <>Save Updates</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
