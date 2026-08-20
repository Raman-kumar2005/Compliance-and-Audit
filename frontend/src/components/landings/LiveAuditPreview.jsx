import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldAlert, Clock, Send, CheckCircle2, Play, Pause, ChevronRight, Activity
} from 'lucide-react';

export default function LiveAuditPreview() {
  const [step, setStep] = useState(0);
  const [currentScore, setCurrentScore] = useState(72);
  const [isPaused, setIsPaused] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef(null);

  // Monitor visibility using IntersectionObserver
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, { threshold: 0.1 });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Monitor prefers-reduced-motion media query
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Coordinated timeline sequence stepper
  useEffect(() => {
    if (isPaused || !isIntersecting || prefersReducedMotion) return;

    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 6);
    }, 4000); // 4 seconds per phase

    return () => clearInterval(timer);
  }, [isPaused, isIntersecting, prefersReducedMotion]);

  // If reduced motion, default to the complete phase
  const activeStep = prefersReducedMotion ? 5 : step;

  // Score counter animation
  useEffect(() => {
    let scoreTarget = 72;
    if (activeStep === 0) scoreTarget = 72;
    else if (activeStep === 1) scoreTarget = 75;
    else if (activeStep === 2) scoreTarget = 78;
    else if (activeStep === 3) scoreTarget = 81;
    else if (activeStep === 4) scoreTarget = 84;
    else if (activeStep === 5) scoreTarget = 86;

    if (prefersReducedMotion) {
      setCurrentScore(scoreTarget);
      return;
    }

    const timer = setInterval(() => {
      setCurrentScore((prev) => {
        if (prev < scoreTarget) return prev + 1;
        if (prev > scoreTarget) return prev - 1;
        clearInterval(timer);
        return prev;
      });
    }, 85);

    return () => clearInterval(timer);
  }, [activeStep, prefersReducedMotion]);

  // Coordinated phase details
  const currentPhase = useMemo(() => {
    const phases = [
      { label: 'Audit started', sub: 'Phase 1/6: Scan initiated' },
      { label: 'Evidence collected', sub: 'Phase 2/6: Syncing Logs' },
      { label: 'Policy mismatch detected', sub: 'Phase 3/6: Analyzing Rules' },
      { label: 'Risk calculated', sub: 'Phase 4/6: Impact assessment' },
      { label: 'HR notified', sub: 'Phase 5/6: Alert routing' },
      { label: 'Report ready', sub: 'Phase 6/6: Complete' },
    ];
    return phases[activeStep];
  }, [activeStep]);

  const riskCounts = useMemo(() => {
    if (activeStep < 2) return { crit: 0, high: 0, med: 0, low: 0 };
    if (activeStep === 2) return { crit: 1, high: 0, med: 0, low: 1 };
    if (activeStep === 3) return { crit: 1, high: 1, med: 1, low: 2 };
    if (activeStep === 4) return { crit: 1, high: 2, med: 2, low: 3 };
    return { crit: 1, high: 2, med: 3, low: 5 };
  }, [activeStep]);

  // SLA status state machine
  const slaStatus = useMemo(() => {
    if (activeStep < 2) return null;
    return activeStep >= 3 ? 'NEAR_BREACH' : 'ON_TRACK';
  }, [activeStep]);

  // Score trend graph coordinates calculations
  const graphCoords = useMemo(() => {
    const points = [
      { x: 10, y: 80 },
      { x: 50, y: 75 },
      { x: 90, y: 70 },
      { x: 130, y: 55 },
      { x: 170, y: 40 },
      { x: 210, y: 20 },
    ];
    const visiblePoints = points.slice(0, activeStep + 1);
    
    const linePath = visiblePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    let areaPath = '';
    if (visiblePoints.length > 0) {
      const lastPoint = visiblePoints[visiblePoints.length - 1];
      areaPath = `${linePath} L ${lastPoint.x} 100 L 10 100 Z`;
    }
    
    return { linePath, areaPath, visiblePoints };
  }, [activeStep]);

  const strokeDasharray = 2 * Math.PI * 34; // r=34
  const strokeOffset = strokeDasharray - (currentScore / 100) * strokeDasharray;

  return (
    <div ref={containerRef} className="w-full select-none select-none relative font-sans">
      
      {/* COMMAND CENTER VISUAL CARD */}
      <div className="bg-[#090d16]/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col min-h-[520px] backdrop-blur-md">
        
        {/* Soft indigo glow effect */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-64 h-64 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

        {/* 1. Header Area */}
        <div className="bg-[#0c111f] border-b border-slate-800/80 px-6 py-4 flex justify-between items-center relative z-10 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase font-mono">LIVE COMPLIANCE AUDIT</span>
            <span className="text-slate-700">•</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">2,184 controls monitored</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-800/50 border border-slate-800 text-[10px] text-slate-300 font-bold uppercase rounded-lg">
              {currentPhase.sub}
            </span>
            
            {/* Pause Control Button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 bg-slate-850 border border-slate-800 hover:border-indigo-500/30 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center"
              title={isPaused ? 'Resume Preview' : 'Pause Preview'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 2. Main Analytics Panels Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 relative z-10">
          
          {/* Left Column: Gauges, Trend Graphic & Risk Distribution */}
          <div className="space-y-4">
            <div className="bg-[#0c101d]/60 border border-slate-800/70 p-5 rounded-2xl flex flex-col sm:flex-row gap-5 items-center justify-between">
              
              {/* Compliance score dial */}
              <div className="flex flex-col items-center text-center">
                <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 block">Readiness Rating</span>
                <div className="relative flex items-center justify-center w-28 h-28">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="34"
                      className="stroke-slate-800/60"
                      strokeWidth="7.5"
                      fill="transparent"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="34"
                      className="stroke-indigo-500 transition-all duration-1000 ease-out"
                      strokeWidth="7.5"
                      fill="transparent"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{currentScore}%</span>
                    <span className="text-[7.5px] text-slate-400 font-extrabold uppercase mt-0.5">Score</span>
                  </div>
                </div>
              </div>

              {/* Live SVG Trend Line Chart */}
              <div className="flex-1 w-full space-y-2">
                <div className="flex justify-between items-center text-[8px] font-extrabold text-slate-500 uppercase tracking-widest">
                  <span>Compliance Trend</span>
                  <span className="text-indigo-400 font-mono">Real-Time Sync</span>
                </div>
                <div className="h-28 bg-[#090d16]/75 border border-slate-850 p-2.5 rounded-xl overflow-hidden relative flex items-center justify-center">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 220 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Grid Lines */}
                    <line x1="0" y1="20" x2="220" y2="20" className="stroke-slate-800/40" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="50" x2="220" y2="50" className="stroke-slate-800/40" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="80" x2="220" y2="80" className="stroke-slate-800/40" strokeWidth="0.5" strokeDasharray="3" />
                    
                    {/* Area fill */}
                    {graphCoords.areaPath && (
                      <path d={graphCoords.areaPath} fill="url(#trendGrad)" className="transition-all duration-1000 ease-out" />
                    )}
                    
                    {/* Line path */}
                    {graphCoords.linePath && (
                      <path 
                        d={graphCoords.linePath} 
                        fill="none" 
                        className="stroke-indigo-500 transition-all duration-1000 ease-out" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                      />
                    )}
                    
                    {/* Coordinate Nodes */}
                    {graphCoords.visiblePoints.map((p, idx) => (
                      <circle 
                        key={idx} 
                        cx={p.x} 
                        cy={p.y} 
                        r="3.5" 
                        className="fill-indigo-400 stroke-slate-950 transition-all duration-500" 
                        strokeWidth="1.5" 
                      />
                    ))}
                  </svg>
                </div>
              </div>
              
            </div>

            {/* Risk Distribution vectors */}
            <div className="bg-[#0c101d]/60 border border-slate-800/70 p-4 rounded-2xl">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block mb-2.5">Risk Distribution</span>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#090d16]/75 border border-slate-850 p-2 text-center rounded-xl">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Critical</span>
                  <span className="text-base font-black text-red-500 block mt-0.5">{riskCounts.crit}</span>
                </div>
                <div className="bg-[#090d16]/75 border border-slate-850 p-2 text-center rounded-xl">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">High</span>
                  <span className="text-base font-black text-orange-500 block mt-0.5">{riskCounts.high}</span>
                </div>
                <div className="bg-[#090d16]/75 border border-slate-850 p-2 text-center rounded-xl">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Medium</span>
                  <span className="text-base font-black text-amber-500 block mt-0.5">{riskCounts.med}</span>
                </div>
                <div className="bg-[#090d16]/75 border border-slate-850 p-2 text-center rounded-xl">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Low</span>
                  <span className="text-base font-black text-emerald-500 block mt-0.5">{riskCounts.low}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Violation panel, SLA, and alert triggers */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Unified violation card */}
              <div className="bg-[#0c101d]/60 border border-slate-800/70 p-4 rounded-2xl min-h-[175px] flex flex-col justify-between relative overflow-hidden">
                {activeStep < 2 ? (
                  <div className="flex flex-col items-center justify-center text-center flex-1 text-slate-500">
                    <Activity className="w-8 h-8 text-slate-700 animate-pulse mb-2" />
                    <span className="text-[10px] font-bold uppercase">Scanning System Registries...</span>
                    <span className="text-[9px] text-slate-650 mt-1">Analyzing log streams for framework compliance</span>
                  </div>
                ) : (
                  <div className="space-y-3.5 animate-in fade-in duration-500 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-red-500">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-extrabold uppercase tracking-wide">Policy mismatch detected</span>
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[8px] font-extrabold uppercase">
                          HIGH
                        </span>
                      </div>
                      
                      <div className="mt-2 text-xs font-bold text-white leading-normal">
                        Employee classification conflict · Department IT Ops
                      </div>
                      <p className="text-[10.5px] text-slate-400 leading-normal mt-1 bg-slate-900 border border-slate-850 px-2.5 py-1.5 rounded-lg font-mono truncate text-slate-350">
                        Evidence: <span className="text-amber-500">EmployeeType=Contractor; ACCESS=Admin; ACCESS_KEY=sk_live_...2ross</span>
                      </p>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-850 pt-3">
                      {/* SLA status shifting */}
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-3.5 h-3.5 ${slaStatus === 'NEAR_BREACH' ? 'text-amber-400 animate-pulse' : 'text-emerald-450'}`} />
                        <span className={`text-[10px] font-bold uppercase transition-all duration-700 ${
                          slaStatus === 'NEAR_BREACH' ? 'text-amber-400' : 'text-emerald-450'
                        }`}>
                          {slaStatus === 'NEAR_BREACH' ? 'SLA: Near Breach · 4h left' : 'SLA: On Track · 18h left'}
                        </span>
                      </div>
                      <button className="px-2.5 py-1 bg-indigo-600/10 border border-indigo-500/25 hover:bg-indigo-650 hover:text-white text-indigo-400 rounded-lg text-[9px] font-bold transition-all cursor-pointer">
                        View evidence
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Toast */}
            <div className="h-14 flex items-end">
              {activeStep >= 4 && (
                <div className="w-full bg-[#0a0f1d] border border-purple-500/20 rounded-xl p-3 shadow-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-500">
                  <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-wider block">HR NOTIFIED</span>
                      <span className="text-[8px] text-slate-500 uppercase font-mono font-bold">Alert Sent</span>
                    </div>
                    <p className="text-[10px] text-slate-350 font-bold truncate mt-0.5">High-risk violation routed to IT department lead</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 3. Bottom Progress Stepper */}
        <div className="bg-[#0a0e1c] border-t border-slate-800/80 px-6 py-5 relative z-10">
          <div className="grid grid-cols-6 gap-2">
            {[
              { label: 'Audit started', icon: CheckCircle2 },
              { label: 'Evidence sync', icon: CheckCircle2 },
              { label: 'Mismatch flag', icon: CheckCircle2 },
              { label: 'Risk calculated', icon: CheckCircle2 },
              { label: 'HR notified', icon: CheckCircle2 },
              { label: 'Report ready', icon: CheckCircle2 },
            ].map((s, idx) => {
              const isActive = idx === activeStep;
              const isDone = idx < activeStep;
              
              return (
                <div key={s.label} className="flex flex-col items-center text-center relative gap-2">
                  {/* Progress Line connectors */}
                  {idx < 5 && (
                    <div 
                      className={`absolute top-[7px] left-[55%] w-[90%] h-[2px] transition-colors duration-700 ${
                        idx < activeStep ? 'bg-indigo-500' : 'bg-slate-800'
                      }`}
                    />
                  )}
                  {/* Stepper Dot */}
                  <div 
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-700 z-10 ${
                      isDone 
                        ? 'bg-indigo-500 border-indigo-500' 
                        : isActive 
                          ? 'bg-slate-950 border-indigo-500 ring-2 ring-indigo-500/25 scale-110' 
                          : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {isDone && <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 fill-current" />}
                  </div>
                  
                  <span 
                    className={`text-[9px] font-extrabold uppercase transition-all duration-500 truncate w-full hidden sm:block ${
                      isActive ? 'text-indigo-400 font-bold' : isDone ? 'text-slate-350' : 'text-slate-600'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Status metadata bar */}
        <div className="bg-[#070b15] px-6 py-2.5 flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase relative z-10 border-t border-slate-850 flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            Remediation Scanner Status: {activeStep === 5 ? 'Audit report ready' : 'Analyzing logs...'}
          </span>
          <span className="font-mono text-slate-600">SLA CHECK ENGINE: ACTIVE</span>
        </div>

      </div>

      {/* Mobile compact single-panel view overlay */}
      <div className="md:hidden block mt-4 bg-[#090d16] border border-slate-800/80 rounded-2xl p-4 space-y-3.5 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400">Score: <span className="text-white font-extrabold">{currentScore}%</span></span>
          </div>
          <span className="text-[9px] font-extrabold text-indigo-400 uppercase">{currentPhase.label}</span>
        </div>
        <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(activeStep + 1) * 16.6}%` }} />
        </div>
        {activeStep >= 2 && (
          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center text-[8px] font-extrabold uppercase">
              <span className="text-red-400">Policy Mismatch Detected</span>
              <span className="text-amber-400">{slaStatus === 'NEAR_BREACH' ? 'Near Breach' : 'On Track'}</span>
            </div>
            <p className="text-[10px] text-slate-350 truncate">Employee classification conflict · Department IT Ops</p>
          </div>
        )}
      </div>

    </div>
  );
}
