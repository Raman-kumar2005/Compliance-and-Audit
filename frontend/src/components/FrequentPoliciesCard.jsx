import React, { useMemo } from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function FrequentPoliciesCard({ violations = [] }) {
  // Aggregate and count occurrences of each broken policy rule
  const policyRankings = useMemo(() => {
    if (!violations || violations.length === 0) return [];

    const counts = {};
    violations.forEach(v => {
      const rule = v.rule_violated || 'Unknown Policy Rule';
      if (!counts[rule]) {
        counts[rule] = {
          name: rule,
          count: 0,
          severity: v.severity || 'Medium',
          department: v.department || 'IT'
        };
      }
      counts[rule].count += 1;
    });

    // Sort by count desc, then by severity importance
    const sorted = Object.values(counts).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      
      const SEVERITY_WEIGHT = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const weightA = SEVERITY_WEIGHT[a.severity.toUpperCase()] || 2;
      const weightB = SEVERITY_WEIGHT[b.severity.toUpperCase()] || 2;
      return weightB - weightA;
    });

    return sorted;
  }, [violations]);

  const maxCount = useMemo(() => {
    if (policyRankings.length === 0) return 1;
    return Math.max(...policyRankings.map(p => p.count));
  }, [policyRankings]);

  // Determine Badge styling based on frequency count
  const getFrequencyBadge = (count) => {
    if (count >= 3) {
      return {
        badge: 'bg-red-500/10 border-red-500/25 text-red-400',
        bar: 'bg-red-500',
        Icon: ShieldAlert
      };
    } else if (count >= 2) {
      return {
        badge: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
        bar: 'bg-amber-500',
        Icon: AlertTriangle
      };
    } else {
      return {
        badge: 'bg-slate-800/40 border-slate-700/50 text-slate-300',
        bar: 'bg-indigo-500',
        Icon: AlertCircle
      };
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#090d16]/95 border border-slate-800 p-5 shadow-xl text-white transition-all duration-300">
      
      {/* Background glow decorator */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="mb-4 relative z-10">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
          Frequency Registry
        </span>
        <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
          Frequent Policy Breaches
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
        </h3>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
          Ranked lists of regulations most frequently violated in current logs.
        </p>
      </div>

      {/* Rankings List */}
      <div className="space-y-3 relative z-10">
        {policyRankings.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#0f172a]/30 border border-slate-800 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Zero Breaches Logged</span>
            <p className="text-[10px] text-slate-400">All company regulations comply fully with operating guidelines.</p>
          </div>
        ) : (
          policyRankings.slice(0, 5).map((policy, idx) => {
            const freq = getFrequencyBadge(policy.count);
            const percentage = (policy.count / maxCount) * 100;

            return (
              <div 
                key={policy.name} 
                className="group p-3 rounded-xl bg-[#0f172a]/40 border border-slate-850 hover:border-slate-800 hover:bg-[#0f172a]/80 transition-all duration-200"
              >
                {/* Rule title and count info */}
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="min-w-0">
                    <span className="text-[9px] font-extrabold text-slate-500 group-hover:text-indigo-400/80 transition-colors uppercase tracking-wider block">
                      Rank #{idx + 1} • {policy.department}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors truncate mt-0.5" title={policy.name}>
                      {policy.name}
                    </h4>
                  </div>

                  {/* Count badge */}
                  <span className={cn(
                    "flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-extrabold tracking-wide uppercase",
                    freq.badge
                  )}>
                    <freq.Icon className="w-2.5 h-2.5" />
                    {policy.count}x
                  </span>
                </div>

                {/* Relative histogram bar */}
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden p-[0.5px]">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-500", freq.bar)} 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}

        {policyRankings.length > 5 && (
          <div className="text-center pt-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
            + {policyRankings.length - 5} other policy rules flagged
          </div>
        )}
      </div>
    </div>
  );
}
