import React, { useMemo } from 'react';
import { 
  ShieldCheck, AlertTriangle, ShieldAlert, 
  TrendingDown, TrendingUp, Sparkles, Info, ShieldAlert as AlertIcon
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function RiskScoreCard({ metrics, violations = [], simulatedRisk = null }) {
  // Use simulated data if provided (for the hackathon demo controller)
  const activeMetrics = simulatedRisk ? simulatedRisk.metrics : metrics;
  const activeViolations = simulatedRisk ? simulatedRisk.violations : violations;

  // 1. Calculate overall compliance & risk scores
  const complianceScore = activeMetrics?.compliance_score ?? 0;
  const riskScore = Math.max(0, Math.min(100, 100 - complianceScore));

  // 2. Risk classification
  // Low Risk: 0-35, Moderate Risk: 36-70, High Risk: 71-100
  const riskConfig = useMemo(() => {
    if (riskScore <= 35) {
      return {
        label: 'Low Risk',
        color: '#10b981', // Emerald
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        textColor: 'text-emerald-400',
        glowClass: 'shadow-[0_0_25px_rgba(16,185,129,0.15)] border-emerald-500/20',
        gaugeGradient: 'url(#greenGradient)',
        Icon: ShieldCheck,
        description: 'AI deployment demonstrates high compliance. System is stable and operates within safe boundaries.'
      };
    } else if (riskScore <= 70) {
      return {
        label: 'Moderate Risk',
        color: '#f59e0b', // Amber
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        textColor: 'text-amber-400',
        glowClass: 'shadow-[0_0_25px_rgba(245,158,11,0.15)] border-amber-500/20',
        gaugeGradient: 'url(#amberGradient)',
        Icon: AlertTriangle,
        description: 'AI deployment shows minor policy deviations. Moderately increased vulnerability profile detected.'
      };
    } else {
      return {
        label: 'High Risk',
        color: '#ef4444', // Red
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        glowClass: 'shadow-[0_0_25px_rgba(239,68,68,0.18)] border-red-500/20',
        gaugeGradient: 'url(#redGradient)',
        Icon: ShieldAlert,
        description: 'AI deployment breaches key regulatory constraints. High probability of operational failure or non-compliance.'
      };
    }
  }, [riskScore]);

  // 3. Trend Indicator Calculation (using compliance_trend or falling back)
  const trendResult = useMemo(() => {
    const trend = activeMetrics?.compliance_trend;
    if (!trend || trend.length < 2) {
      return { change: 0, text: 'No trend data', isImprovement: true, neutral: true };
    }

    const currentComp = trend[trend.length - 1];
    const previousComp = trend[trend.length - 2];
    
    const currentRisk = 100 - currentComp;
    const previousRisk = 100 - previousComp;
    const diff = currentRisk - previousRisk; // e.g. 16 - 19 = -3 (improved)

    if (diff < 0) {
      return {
        change: Math.abs(diff),
        text: `↓ ${Math.abs(diff)} pts`,
        isImprovement: true, // Decreasing risk is good!
        label: 'Improved'
      };
    } else if (diff > 0) {
      return {
        change: diff,
        text: `↑ ${diff} pts`,
        isImprovement: false, // Increasing risk is bad
        label: 'Worsened'
      };
    } else {
      return {
        change: 0,
        text: '0 pts',
        isImprovement: true,
        neutral: true,
        label: 'Unchanged'
      };
    }
  }, [activeMetrics]);

  // 4. Construct Risk Trend history for sparkline (6 points)
  const riskTrend = useMemo(() => {
    const trend = activeMetrics?.compliance_trend || [70, 75, 80, 82, 85, complianceScore];
    return trend.map(score => 100 - score);
  }, [activeMetrics, complianceScore]);

  // 5. Sparkline path drawing
  const sparklinePath = useMemo(() => {
    const width = 180;
    const height = 40;
    const padding = 4;
    const pointsCount = riskTrend.length;
    
    if (pointsCount === 0) return '';
    
    const maxVal = Math.max(...riskTrend, 30); // scale reference
    const minVal = Math.min(...riskTrend, 0);
    const range = maxVal - minVal || 1;

    const coords = riskTrend.map((val, idx) => {
      const x = padding + (idx / (pointsCount - 1)) * (width - padding * 2);
      const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
      return { x, y };
    });

    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      // Smooth cubic bezier curves
      const cpX1 = coords[i-1].x + (coords[i].x - coords[i-1].x) / 2;
      const cpY1 = coords[i-1].y;
      const cpX2 = coords[i-1].x + (coords[i].x - coords[i-1].x) / 2;
      const cpY2 = coords[i].y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${coords[i].x} ${coords[i].y}`;
    }

    // Fill path helper (closing it at the bottom)
    const fillPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

    return { linePath, fillPath };
  }, [riskTrend]);

  // 6. Violation Distribution Counts
  const severityCounts = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    
    // Check if risk distribution is provided in metrics
    if (activeMetrics?.risk_distribution) {
      const dist = activeMetrics.risk_distribution;
      counts.Critical = dist.Critical || dist.critical || 0;
      counts.High = dist.High || dist.high || 0;
      counts.Medium = dist.Medium || dist.medium || 0;
      counts.Low = dist.Low || dist.low || 0;
    } else {
      // Fallback: aggregate from violations array
      activeViolations.forEach(v => {
        const sev = v.severity || 'Medium';
        const normalized = sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase();
        if (counts[normalized] !== undefined) {
          counts[normalized]++;
        } else if (normalized === 'Crit') {
          counts.Critical++;
        } else {
          counts.Medium++; // fallback default
        }
      });
    }

    return counts;
  }, [activeMetrics, activeViolations]);

  const totalViolations = Object.values(severityCounts).reduce((a, b) => a + b, 0);

  // SVG circular gauge properties
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (riskScore / 100) * circumference;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl bg-[#090d16]/95 text-white p-6 md:p-8 border border-slate-800 transition-all duration-500",
      riskConfig.glowClass
    )}>
      {/* Glow highlight background element */}
      <div 
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20 -mr-16 -mt-16 transition-colors duration-500"
        style={{ backgroundColor: riskConfig.color }}
      />
      
      {/* Card Header */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
            AI Compliance Scan
          </span>
          <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            AI Risk Assessment Profile
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          </h3>
        </div>
        
        {/* Trend Indicator Pill */}
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md transition-all duration-500",
          trendResult.neutral 
            ? "bg-slate-800/40 border-slate-700/50 text-slate-400"
            : trendResult.isImprovement 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.06)]"
              : "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.06)]"
        )}>
          {trendResult.neutral ? (
            <Info className="w-3.5 h-3.5" />
          ) : trendResult.isImprovement ? (
            <TrendingDown className="w-3.5 h-3.5" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5" />
          )}
          <span>{trendResult.text}</span>
          <span className="text-[10px] opacity-75 font-medium">({trendResult.label.toLowerCase()})</span>
        </div>
      </div>

      {/* Main KPI Row: Gauge + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mb-6 relative z-10">
        
        {/* SVG Circular Gauge */}
        <div className="md:col-span-5 flex justify-center py-2">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90">
              {/* Gradients */}
              <defs>
                <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#1e293b"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="opacity-40"
              />
              
              {/* Foreground Progress */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={riskConfig.gaugeGradient}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            </svg>
            
            {/* Center Text */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-extrabold tracking-tight text-white transition-all duration-500">
                {riskScore}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">
                Risk Score
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic description & status display */}
        <div className="md:col-span-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl transition-all duration-500", riskConfig.bgColor, riskConfig.textColor)}>
              <riskConfig.Icon className="w-6 h-6" />
            </div>
            <div>
              <h4 className={cn("text-xl font-extrabold tracking-tight transition-colors duration-500", riskConfig.textColor)}>
                {riskConfig.label}
              </h4>
              <p className="text-xs text-slate-400 font-medium">Compliance level: {complianceScore}%</p>
            </div>
          </div>
          
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
            {riskConfig.description}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-800/80 my-4 relative z-10" />

      {/* Bottom section: Sparkline trend + Violation breakdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end relative z-10">
        
        {/* Trend Sparkline */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-400">6-Week Risk Trend</span>
            <span className="text-[10px] text-slate-500 font-mono">
              Peak: {Math.max(...riskTrend)}%
            </span>
          </div>
          
          {/* Sparkline Drawing */}
          <div className="h-10 w-full flex items-center bg-[#0d1527] rounded-xl border border-slate-800/60 p-1">
            <svg viewBox="0 0 180 40" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="sparklineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={riskConfig.color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={riskConfig.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Gradient Area under line */}
              {sparklinePath.fillPath && (
                <path d={sparklinePath.fillPath} fill="url(#sparklineAreaGrad)" style={{ transition: 'd 1s ease-in-out' }} />
              )}
              {/* Trend Stroke Line */}
              {sparklinePath.linePath && (
                <path
                  d={sparklinePath.linePath}
                  fill="none"
                  stroke={riskConfig.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ transition: 'd 1s ease-in-out' }}
                />
              )}
              {/* Highlight current point */}
              <circle
                cx={180 - 4}
                cy={40 - 4 - ((riskScore - Math.min(...riskTrend, 0)) / (Math.max(...riskTrend, 30) - Math.min(...riskTrend, 0) || 1)) * (40 - 8)}
                r="3"
                fill={riskConfig.color}
                stroke="#090d16"
                strokeWidth="1.5"
                style={{ transition: 'cy 1s ease-in-out' }}
              />
            </svg>
          </div>
        </div>

        {/* Small Progress Breakdown for Severities */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-slate-400">Violation Breakdown</span>
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 font-bold px-1.5 py-0.5 rounded">
              {totalViolations} issues
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Critical Flags */}
            <div className="bg-[#0f172a] rounded-lg p-2 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Crit
              </span>
              <span className="font-bold text-red-400">{severityCounts.Critical}</span>
            </div>

            {/* High Flags */}
            <div className="bg-[#0f172a] rounded-lg p-2 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                High
              </span>
              <span className="font-bold text-orange-400">{severityCounts.High}</span>
            </div>

            {/* Medium Flags */}
            <div className="bg-[#0f172a] rounded-lg p-2 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Med
              </span>
              <span className="font-bold text-amber-400">{severityCounts.Medium}</span>
            </div>

            {/* Low Flags */}
            <div className="bg-[#0f172a] rounded-lg p-2 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Low
              </span>
              <span className="font-bold text-emerald-400">{severityCounts.Low}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
