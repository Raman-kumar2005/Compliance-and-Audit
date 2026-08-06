import React, { useState, useMemo } from 'react';
import { 
  LogOut, ShieldAlert, CheckCircle2, User, Building, AlertTriangle, 
  Clock, CheckSquare, Square, Zap, Info, Sparkles 
} from 'lucide-react';
import DrillDownModal from './DrillDownModal';
import { cn } from '../lib/utils';

export default function EmployeeDashboard({ user, onLogout }) {
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Complete mandatory Policy 4.3 Training (Security Awareness)', completed: false, severity: 'Medium' },
    { id: 2, text: 'Sign off on updated corporate Data Privacy Pledge', completed: true, severity: 'Low' },
    { id: 3, text: 'Acknowledge E-ROSS session authorization key refresh request', completed: false, severity: 'High' }
  ]);

  // Reroute simulation support states (local modal states)
  const [mitigationStatus, setMitigationStatus] = useState('OPEN');
  const [mitigationNotes, setMitigationNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Extract mock personal compliance logs
  const employeeEmail = user?.email || 'employee.ross@security-hq.com';
  const employeeId = employeeEmail.split('@')[0].toUpperCase();

  // Mock employee violations registry (cohesive and linked to Ross)
  const personalViolations = useMemo(() => [
    {
      id: "emp-204",
      employee: employeeId,
      department: "Sales & Marketing",
      rule_violated: "Policy 4.3 - Training Completion Requirements",
      log_entry: `Employee ID: ${employeeId}, DepartmentType: Sales, Training Date: 12-Feb-26, Status: Incomplete`,
      severity: "Medium",
      explanation: "Employee Ross's security training is marked 'Incomplete' after exceeding the standard 60-day company requirement.",
      recommendation: "Immediately access the training portal and complete the module by the end of the current cycle.",
      status: "OPEN",
      mitigation_notes: ""
    },
    {
      id: "emp-209",
      employee: employeeId,
      department: "IT Ops (Temporary)",
      rule_violated: "Policy 3.2 - Open Access Key in Version Control",
      log_entry: `GitHub Commit push: Repo 'ross-analytics-dashboard', File: 'env.local', Secret: 'sk_live_...2ross'`,
      severity: "High",
      explanation: "An active access key 'sk_live_...2ross' was committed to a public Git repository. High leak hazard.",
      recommendation: "Rotate the access secret immediately and delete the GitHub commit log history.",
      status: "IN_PROGRESS",
      mitigation_notes: "Key rotation initiated by Ross. Awaiting final token verification."
    }
  ], [employeeId]);

  // Compute a personal compliance score based on task completions and alerts
  const personalComplianceScore = useMemo(() => {
    const uncompletedTasksCount = tasks.filter(t => !t.completed).length;
    const activeViolationsCount = personalViolations.filter(v => v.status === 'OPEN').length;
    
    // Base 100, deduct points
    const score = 100 - (uncompletedTasksCount * 5) - (activeViolationsCount * 12);
    return Math.max(0, score);
  }, [tasks, personalViolations]);

  const toggleTask = (taskId) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, completed: !t.completed };
      }
      return t;
    }));
  };

  const handleSaveMitigation = () => {
    if (!selectedViolation) return;
    setSaving(true);
    
    setTimeout(() => {
      setSaving(false);
      // Simulate saving to local state
      const updated = personalViolations.find(v => v.id === selectedViolation.id);
      if (updated) {
        updated.status = mitigationStatus;
        updated.mitigation_notes = mitigationNotes;
      }
      setSelectedViolation(null);
    }, 800);
  };

  // SVG Gauge calculations
  const radius = 55;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (personalComplianceScore / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#090d16] text-[#e2e8f0] font-sans selection:bg-indigo-500/30 flex flex-col relative overflow-hidden">
      
      {/* Glow backgrounds */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-purple-500/5 blur-[100px] pointer-events-none -ml-32 -mb-32" />

      {/* Main navigation header */}
      <nav className="bg-[#0b0f1a] border-b border-slate-800/80 no-print">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">AI Compliance Portal</h2>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Employee Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Employee tag */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>{employeeEmail}</span>
              <span className="text-[9px] bg-indigo-500/15 text-indigo-400 font-extrabold px-1.5 py-0.5 rounded border border-indigo-500/25 uppercase">Staff</span>
            </div>

            {/* Logout button */}
            <button 
              onClick={onLogout}
              className="text-slate-400 hover:text-white px-3.5 py-2 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700/60 transition-all flex items-center gap-2 cursor-pointer text-xs font-bold"
            >
              <LogOut className="w-4 h-4 text-red-400" /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content body */}
      <main className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 flex-grow space-y-8 relative z-10">
        
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#0c1224] to-[#0f172a] border border-slate-800/80 shadow-lg">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              Welcome back, Ross!
              <Sparkles className="w-5 h-5 text-indigo-400 animate-bounce" />
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-medium">Here is your personal compliance assessment profile and policy tasks registry.</p>
          </div>
          <div className="flex gap-4 text-xs font-semibold text-slate-400">
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-500">Corporate Domain</span>
              <span className="text-slate-200 mt-0.5 block">security-hq.com</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="block text-[9px] uppercase font-bold text-slate-500">Last Assessment</span>
              <span className="text-slate-200 mt-0.5 block flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-400" /> Today</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Circular compliance gauge card */}
          <div className="lg:col-span-4 flex flex-col justify-between p-6 rounded-3xl bg-[#0b0f1a] border border-slate-800/80 shadow-md">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Compliance Rating</span>
              <h3 className="text-base font-bold text-white">Your Compliance Score</h3>
            </div>
            
            <div className="flex justify-center py-6">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r={radius}
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="opacity-40"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r={radius}
                    stroke="url(#employeeScoreGrad)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                  />
                  <defs>
                    <linearGradient id="employeeScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-white">{personalComplianceScore}%</span>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">Rating</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#0f172a]/60 rounded-2xl border border-slate-850 text-center">
              <p className="text-[10px] text-slate-400 leading-normal font-medium">
                {personalComplianceScore >= 80 
                  ? '🟢 Your rating is strong! Continue checking off requirements to reach 100%.' 
                  : '🟡 Standard attention required. Review outstanding training tasks to resolve risk flags.'}
              </p>
            </div>
          </div>

          {/* Outstanding compliance checklist */}
          <div className="lg:col-span-8 p-6 rounded-3xl bg-[#0b0f1a] border border-slate-800/80 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Corporate Checklist</span>
                  <h3 className="text-base font-bold text-white">Outstanding Tasks & Pledges</h3>
                </div>
                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {tasks.filter(t => !t.completed).length} pending
                </span>
              </div>

              {/* Task Rows */}
              <div className="space-y-3">
                {tasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#0f172a]/40 border border-slate-850 hover:border-slate-800 hover:bg-[#0f172a] transition-all duration-200 cursor-pointer group"
                  >
                    <button type="button" className="text-slate-400 group-hover:text-indigo-400 p-0.5 transition-colors">
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-md border-2 border-slate-700 group-hover:border-indigo-500" />
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs md:text-sm font-semibold text-slate-200 transition-all",
                        task.completed ? "line-through text-slate-500 font-medium" : "text-slate-200"
                      )}>
                        {task.text}
                      </p>
                      <div className="flex gap-2 items-center mt-1 text-[9px] font-extrabold tracking-wide uppercase">
                        <span className={cn(
                          task.severity === 'High' ? 'text-red-400' : task.severity === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                        )}>
                          {task.severity} priority
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className={task.completed ? 'text-emerald-400' : 'text-slate-400'}>
                          {task.completed ? 'Completed' : 'Action Required'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-medium mt-4">
              ℹ️ Click any requirement row above to toggle your task status. All completions compile in real-time.
            </div>
          </div>

        </div>

        {/* Personal violations log list */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0b0f1a] border border-slate-800/80 shadow-md">
          <div className="mb-5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Corporate Logs</span>
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              Personal Security Audit Logs
              <ShieldAlert className="w-4.5 h-4.5 text-indigo-400" />
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-normal">The following security events were flagged under your corporate credentials. Review details and file mitigation notes below.</p>
          </div>

          {/* List items */}
          <div className="space-y-4">
            {personalViolations.map((violation) => {
              const isCritOrHigh = ['CRITICAL', 'HIGH'].includes((violation.severity || '').toUpperCase());
              
              return (
                <div 
                  key={violation.id} 
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl bg-[#0f172a]/30 border border-slate-850 hover:border-indigo-500/25 transition-all duration-300 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded border text-[9px] font-extrabold tracking-wider uppercase",
                        isCritOrHigh ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                      )}>
                        {violation.severity} Severity
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase font-mono">ID: #{violation.id}</span>
                      <span className="text-slate-700">•</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        violation.status === 'MITIGATED' ? 'text-emerald-400' : 'text-amber-400'
                      )}>
                        {violation.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white group-hover:text-indigo-400 transition-colors">
                      {violation.rule_violated}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xl font-medium mt-0.5 line-clamp-1">
                      {violation.explanation}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedViolation(violation);
                      setMitigationStatus(violation.status || 'OPEN');
                      setMitigationNotes(violation.mitigation_notes || '');
                    }}
                    className="px-4 py-2 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 select-none flex-shrink-0"
                  >
                    View Details & Mitigate
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* Drill-down Modal details pop-up */}
      {selectedViolation && (
        <DrillDownModal
          violation={selectedViolation}
          onClose={() => setSelectedViolation(null)}
          mitigationStatus={mitigationStatus}
          setMitigationStatus={setMitigationStatus}
          mitigationNotes={mitigationNotes}
          setMitigationNotes={setMitigationNotes}
          onSave={handleSaveMitigation}
          saving={saving}
        />
      )}
    </div>
  );
}
