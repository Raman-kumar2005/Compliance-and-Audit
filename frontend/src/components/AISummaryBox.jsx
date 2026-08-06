import React, { useMemo } from 'react';
import { Sparkles, ShieldAlert, AlertCircle, Zap, ShieldCheck, ArrowRightCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AISummaryBox({ violations = [] }) {
  // 1. Identify the highest-severity violation in the current audit
  const primaryViolation = useMemo(() => {
    if (!violations || violations.length === 0) return null;

    const SEVERITY_LEVELS = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    
    return [...violations].reduce((highest, current) => {
      const highestLevel = SEVERITY_LEVELS[(highest.severity || 'Medium').toUpperCase()] || 2;
      const currentLevel = SEVERITY_LEVELS[(current.severity || 'Medium').toUpperCase()] || 2;
      return currentLevel > highestLevel ? current : highest;
    });
  }, [violations]);

  // 2. Format Risk, Reason, and Action dynamically
  const summary = useMemo(() => {
    if (!primaryViolation) {
      return {
        hasViolations: false,
        risk: 'No operational policy violations detected.',
        reason: 'Company audit logs successfully correlate with the established compliance policies. No anomalous behavior or credential abuses found.',
        action: 'Maintain existing access control filters and schedule the next periodic automated policy scan.',
        severity: 'LOW',
        statusColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/5',
        borderColor: 'border-emerald-500/20',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.06)]'
      };
    }

    const severity = (primaryViolation.severity || 'Medium').toUpperCase();
    let statusColor = 'text-amber-400';
    let bgColor = 'bg-amber-500/5';
    let borderColor = 'border-amber-500/20';
    let glow = 'shadow-[0_0_20px_rgba(245,158,11,0.06)]';

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      statusColor = 'text-red-400';
      bgColor = 'bg-red-500/5';
      borderColor = 'border-red-500/20';
      glow = 'shadow-[0_0_25px_rgba(239,68,68,0.08)]';
    }

    return {
      hasViolations: true,
      risk: `${severity} Priority Breach: ${primaryViolation.rule_violated || 'Policy Deviation'}`,
      reason: primaryViolation.explanation || 'Unauthorised action occurred bypassing security constraints.',
      action: primaryViolation.recommendation || 'Initiate standard incident response protocol and flag the affected credentials.',
      severity,
      statusColor,
      bgColor,
      borderColor,
      glow
    };
  }, [primaryViolation]);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl bg-[#090b16] border text-white p-6 md:p-8 transition-all duration-500",
      summary.borderColor,
      summary.glow
    )}>
      {/* Animated glow background */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 blur-3xl pointer-events-none rounded-full animate-pulse" />

      {/* Top Header Row */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
              AI Insight Summary
            </h4>
            <p className="text-[10px] text-slate-400 font-medium">Gemini-Engineered Audit Digest</p>
          </div>
        </div>

        {/* Audit Status Pill */}
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border tracking-wider flex items-center gap-1.5 backdrop-blur-md transition-all duration-500",
          summary.bgColor,
          summary.statusColor,
          summary.borderColor
        )}>
          {summary.hasViolations ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5" />
              Action Required
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 animate-bounce" />
              Fully Compliant
            </>
          )}
        </span>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Biggest Risk */}
        <div className="group flex flex-col justify-between p-5 rounded-2xl bg-[#0c1224]/50 border border-slate-800 hover:border-red-500/25 hover:bg-[#0c1224] transition-all duration-300">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Biggest Risk Found
              </span>
            </div>
            <h5 className="text-sm font-extrabold leading-snug text-slate-100 group-hover:text-white transition-colors duration-300">
              {summary.risk}
            </h5>
          </div>
          <p className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">
            Criticality index prioritizes this flag as the primary vulnerability in this logs segment.
          </p>
        </div>

        {/* Main Reason / Trigger */}
        <div className="group flex flex-col justify-between p-5 rounded-2xl bg-[#0c1224]/50 border border-slate-800 hover:border-amber-500/25 hover:bg-[#0c1224] transition-all duration-300">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertCircle className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Root Cause Trigger
              </span>
            </div>
            <h5 className="text-sm font-bold leading-normal text-slate-200 group-hover:text-slate-100 transition-colors duration-300">
              {summary.reason}
            </h5>
          </div>
          <p className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">
            Evidence log signature indicates anomalous activity triggering this security flag.
          </p>
        </div>

        {/* Next Action */}
        <div className="group flex flex-col justify-between p-5 rounded-2xl bg-[#0c1224]/50 border border-slate-800 hover:border-emerald-500/25 hover:bg-[#0c1224] transition-all duration-300">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Recommended Action
              </span>
            </div>
            <h5 className="text-sm font-extrabold leading-snug text-emerald-300 group-hover:text-emerald-200 transition-colors duration-300">
              {summary.action}
            </h5>
          </div>
          <p className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">
            Suggested mitigation step to isolate risk, seal credentials, and prevent lateral exploit.
          </p>
        </div>

      </div>
    </div>
  );
}
