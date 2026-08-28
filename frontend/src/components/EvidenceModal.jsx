import React, { useEffect, useMemo } from 'react';
import { 
  X, ShieldAlert, AlertTriangle, Users, FileText, 
  Lock, Zap, CheckCircle2, ShieldCheck, EyeOff, Send, Clock
} from 'lucide-react';
import { cn } from '../lib/utils';

// Sensitive keys to automatically mask in evidence display
const SENSITIVE_KEYS = ['salary', 'compensation', 'ssn', 'social_security', 'age', 'gender', 'race', 'marital_status', 'phone', 'home_address', 'personal_email'];

export default function EvidenceModal({ 
  violation, 
  onClose, 
  onMarkResolved, 
  onEscalate 
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const severityStyle = useMemo(() => {
    const sev = (violation?.severity || 'Medium').toUpperCase();
    if (sev === 'CRITICAL') {
      return {
        badge: 'bg-red-500/10 border-red-500/30 text-red-400',
        label: 'Critical Risk',
        Icon: ShieldAlert
      };
    } else if (sev === 'HIGH') {
      return {
        badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
        label: 'High Risk',
        Icon: ShieldAlert
      };
    } else if (sev === 'MEDIUM') {
      return {
        badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        label: 'Medium Risk',
        Icon: AlertTriangle
      };
    } else {
      return {
        badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        label: 'Low Risk',
        Icon: ShieldCheck
      };
    }
  }, [violation]);

  // Formatted & sanitized evidence rows
  const evidenceRows = useMemo(() => {
    if (!violation) return [];
    
    // Check if structured sanitized_evidence is available
    if (violation.sanitized_evidence && typeof violation.sanitized_evidence === 'object') {
      return Object.entries(violation.sanitized_evidence).map(([key, val]) => {
        const isSensitive = SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k));
        const displayVal = isSensitive ? '•••••• [MASKED FOR PRIVACY]' : String(val);
        return { key, value: displayVal, isMasked: isSensitive };
      });
    }

    // Fallback: parse log_entry
    if (violation.log_entry) {
      const parts = violation.log_entry.split(',').map(p => p.trim());
      const parsed = [];
      parts.forEach(part => {
        const colonIdx = part.indexOf(':');
        if (colonIdx !== -1) {
          const k = part.substring(0, colonIdx).trim();
          const v = part.substring(colonIdx + 1).trim();
          const isSensitive = SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk));
          parsed.push({
            key: k,
            value: isSensitive ? '•••••• [MASKED FOR PRIVACY]' : v,
            isMasked: isSensitive
          });
        } else {
          parsed.push({ key: 'Log Record', value: part, isMasked: false });
        }
      });
      return parsed.length > 0 ? parsed : [{ key: 'Log Entry', value: violation.log_entry, isMasked: false }];
    }

    return [{ key: 'Evidence Status', value: 'Logged during compliance scan', isMasked: false }];
  }, [violation]);

  if (!violation) return null;

  return (
    <div 
      className="fixed inset-0 bg-[#020617]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-modal-title"
    >
      <div className="relative bg-[#090d16] border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-white">
        
        {/* Top Header */}
        <div className="bg-[#0c1224] border-b border-slate-800/80 px-6 py-4 flex justify-between items-center relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase">
                Finding #{violation.id || '101'}
              </span>
              <span className="text-slate-600">•</span>
              <span className={cn("px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border tracking-wider", severityStyle.badge)}>
                {severityStyle.label}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400 font-semibold">{violation.department || 'Operations'}</span>
            </div>
            <h3 id="evidence-modal-title" className="text-base font-bold text-white tracking-tight mt-1">
              Audit Evidence & Finding Details
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-5 overflow-y-auto relative z-10 flex-1">
          
          {/* Policy Clause Row */}
          <div className="bg-[#0f172a]/50 border border-slate-800 p-4 rounded-2xl space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Policy Clause
            </span>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{violation.rule_violated || 'General Compliance Policy Mandate'}</span>
            </div>
          </div>

          {/* Observed Evidence (Sanitized Grid) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Observed Evidence
              </span>
              <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> PII & Sensitive Fields Masked
              </span>
            </div>
            
            <div className="bg-[#030712] border border-slate-850 rounded-2xl p-4 font-mono text-xs space-y-2">
              {evidenceRows.map((row, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-slate-400 font-semibold">{row.key}</span>
                  <span className={cn(
                    "text-right font-medium break-all",
                    row.isMasked ? "text-amber-400 italic font-sans text-xs" : "text-slate-200"
                  )}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Expected vs Detected Gap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0f172a]/40 border border-slate-800/80 p-4 rounded-2xl">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Expected Condition
              </span>
              <p className="text-xs text-emerald-300 font-medium leading-relaxed">
                Full adherence to established access restrictions, timely certification renewals, and multi-factor authentication mandates.
              </p>
            </div>
            
            <div className="bg-[#0f172a]/40 border border-slate-800/80 p-4 rounded-2xl">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Detected Gap
              </span>
              <p className="text-xs text-red-300 font-medium leading-relaxed">
                Activity log timestamps indicate non-conformance or uncertified access exceeding allowable policy windows.
              </p>
            </div>
          </div>

          {/* AI Explanation ("Why this matters") */}
          <div className="bg-[#0f172a]/40 border border-slate-800/80 p-4 rounded-2xl space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              AI Explanation (Why this matters)
            </span>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {violation.explanation || 'Anomalous activity detected in production event stream contradicting documented safety standards.'}
            </p>
          </div>

          {/* Recommended Next Action */}
          <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-2xl space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">
              Recommended Next Action
            </span>
            <p className="text-xs text-indigo-200 leading-relaxed font-semibold">
              {violation.recommendation || 'Initiate standard remediation, schedule required employee retake or update credential authorization.'}
            </p>
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="bg-[#0c1224] border-t border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 relative z-10">
          <div className="text-xs text-slate-500 font-medium">
            Affected Employee: <span className="text-slate-300 font-bold">{violation.employee || 'EMP-1044'}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {onEscalate && (
              <button
                type="button"
                onClick={() => onEscalate(violation)}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Escalate
              </button>
            )}

            {onMarkResolved && (
              <button
                type="button"
                onClick={() => onMarkResolved(violation)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
