import React, { useMemo } from 'react';
import { Lock, Shield, Users, CreditCard, Clock, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ComplianceBreakdownCard({ violations = [] }) {
  // 1. Core Categories Configuration
  const categories = useMemo(() => [
    {
      id: 'access',
      name: 'Access Control',
      icon: Lock,
      keywords: ['access', 'key', 'auth', 'mfa', 'credential', 'identity', 'login', 'password', 'token'],
      description: 'IAM policies, API secret keys, database credentials, and multi-factor authentication (MFA) controls.'
    },
    {
      id: 'data',
      name: 'Data Protection',
      icon: Shield,
      keywords: ['data', 'leak', 'exfiltration', 'pii', 'privacy', 'customer', 'database', 'db'],
      description: 'Customer PII management, database exfiltration prevention, encryption standards, and logs handling.'
    },
    {
      id: 'employee',
      name: 'Employee Classification',
      icon: Users,
      keywords: ['classification', 'contractor', 'employee', 'role', 'training', 'compliance requirement', 'onboarding'],
      description: 'Mandatory training completions, employment role classifications, and security clearances.'
    },
    {
      id: 'financial',
      name: 'Financial Approval',
      icon: CreditCard,
      keywords: ['financial', 'wire', 'transaction', 'amount', 'cost', 'approval', 'payment', 'budget'],
      description: 'High-value transactions audit trail, double-approval validation, and MFA bypass audits.'
    },
    {
      id: 'hours',
      name: 'Working Hours',
      icon: Clock,
      keywords: ['hours', 'overtime', 'working', 'work', 'time', 'clock', 'schedule', 'shift'],
      description: 'Regulatory shift timings, overtime compliance, rest periods, and labor regulation checks.'
    }
  ], []);

  // 2. Calculate category scores based on violations list
  const categoryScores = useMemo(() => {
    const scores = { access: 100, data: 100, employee: 100, financial: 100, hours: 100 };

    violations.forEach(v => {
      const rule = (v.rule_violated || '').toLowerCase();
      const explanation = (v.explanation || '').toLowerCase();
      const department = (v.department || '').toLowerCase();
      const textToMatch = `${rule} ${explanation} ${department}`;

      // Find which categories match this violation
      let matchedCategory = null;
      
      // Match by keyword first
      for (const cat of categories) {
        if (cat.keywords.some(k => textToMatch.includes(k))) {
          matchedCategory = cat.id;
          break;
        }
      }

      // If no match by keyword, map by department
      if (!matchedCategory) {
        if (department.includes('it') || department.includes('security')) {
          matchedCategory = 'access';
        } else if (department.includes('hr') || department.includes('sales')) {
          matchedCategory = 'employee';
        } else if (department.includes('finance') || department.includes('billing')) {
          matchedCategory = 'financial';
        } else if (department.includes('ops') || department.includes('operations')) {
          matchedCategory = 'hours';
        } else {
          matchedCategory = 'data'; // fallback default
        }
      }

      // Determine deduction amount based on severity
      const severity = (v.severity || 'Medium').toUpperCase();
      let deduction = 15; // default Medium
      if (severity === 'CRITICAL') deduction = 45;
      else if (severity === 'HIGH') deduction = 30;
      else if (severity === 'MEDIUM') deduction = 20;
      else if (severity === 'LOW') deduction = 10;

      // Apply deduction to matching category
      if (scores[matchedCategory] !== undefined) {
        scores[matchedCategory] = Math.max(0, scores[matchedCategory] - deduction);
      }
    });

    return scores;
  }, [violations, categories]);

  // 3. Status mappings
  const getStatusConfig = (score) => {
    if (score >= 80) {
      return {
        label: 'Strong',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/20',
        bgColor: 'bg-emerald-500/10',
        barColor: 'bg-emerald-500',
        barTrack: 'bg-emerald-950/20',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)]',
        Icon: CheckCircle2
      };
    } else if (score >= 50) {
      return {
        label: 'Moderate Risk',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/20',
        bgColor: 'bg-amber-500/10',
        barColor: 'bg-amber-500',
        barTrack: 'bg-amber-950/20',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.1)]',
        Icon: AlertTriangle
      };
    } else {
      return {
        label: 'Weak Compliance',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/20',
        bgColor: 'bg-red-500/10',
        barColor: 'bg-red-500',
        barTrack: 'bg-red-950/20',
        glow: 'shadow-[0_0_15px_rgba(239,68,68,0.12)]',
        Icon: ShieldAlert
      };
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#090d16]/95 text-white p-6 md:p-8 border border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.4)] transition-all duration-300">
      
      {/* Background decoration glow */}
      <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-6 relative z-10">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
          Compliance Domains
        </span>
        <h3 className="text-xl font-bold tracking-tight text-white">
          Framework Category Breakdown
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Analysis of core compliance dimensions. Strong categories demonstrate full log adherence; weaker areas require immediate remediation.
        </p>
      </div>

      {/* Category List */}
      <div className="space-y-4 relative z-10">
        {categories.map(cat => {
          const score = categoryScores[cat.id];
          const status = getStatusConfig(score);
          const IconComponent = cat.icon;
          const StatusIcon = status.Icon;

          return (
            <div 
              key={cat.id} 
              className={cn(
                "group p-4 rounded-2xl bg-[#0f172a]/50 border border-slate-800/80 hover:border-slate-700/50 hover:bg-[#0f172a] transition-all duration-300",
                status.glow
              )}
            >
              {/* Info row */}
              <div className="flex justify-between items-start gap-4 mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-800 text-slate-300 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 border border-slate-700/50 transition-all duration-300">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors duration-300">
                      {cat.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-snug font-medium mt-0.5 max-w-[280px] sm:max-w-md">
                      {cat.description}
                    </p>
                  </div>
                </div>

                {/* Score & Status Badge */}
                <div className="flex flex-col items-end flex-shrink-0 text-right">
                  <span className="text-base font-extrabold text-white tracking-tight">
                    {score}%
                  </span>
                  
                  <span className={cn(
                    "flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider",
                    status.textColor, status.borderColor, status.bgColor
                  )}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {status.label}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full overflow-hidden bg-slate-900 border border-slate-800/60 p-[1px]">
                <div 
                  className={cn("h-full rounded-full transition-all duration-1000 ease-out", status.barColor)} 
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
