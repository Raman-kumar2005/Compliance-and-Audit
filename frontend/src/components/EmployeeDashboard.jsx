import React, { useState, useMemo, useEffect } from 'react';
import { 
  LogOut, ShieldAlert, CheckCircle2, User, Clock, Loader2, Lock, Building 
} from 'lucide-react';
import axios from 'axios';
import MitigationModal from './MitigationModal';
import PolicyAcknowledgmentModal from './PolicyAcknowledgmentModal';
import SLAStatusIndicator from './SLAStatusIndicator';
import { cn } from '../lib/utils';

const BACKEND_URL = 'http://127.0.0.1:8000/api';

export default function EmployeeDashboard({ user, onLogout }) {
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [error, setError] = useState('');
  
  // Policy Acknowledgment states
  const [assignedPolicies, setAssignedPolicies] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState('');
  const [selectedPolicyForSign, setSelectedPolicyForSign] = useState(null);

  const [tasks, setTasks] = useState([
    { id: 1, text: 'Complete mandatory Policy 4.3 Training (Security Awareness)', completed: false, severity: 'Medium' },
    { id: 2, text: 'Sign off on updated corporate Data Privacy Pledge', completed: true, severity: 'Low' },
    { id: 3, text: 'Acknowledge E-ROSS session authorization key refresh request', completed: false, severity: 'High' }
  ]);

  const employeeEmail = user?.email || 'employee.ross@security-hq.com';

  const authHeader = useMemo(() => {
    if (!user || !user.token) return {};
    return { Authorization: `Bearer ${user.token}` };
  }, [user]);

  const fetchViolations = async () => {
    setLoadingViolations(true);
    setError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/violations`, { headers: authHeader });
      setViolations(response.data);
    } catch (err) {
      console.error("Failed to load employee violations:", err);
      setError("Failed to fetch assigned violations. Showing offline mock details.");
    } finally {
      setLoadingViolations(false);
    }
  };

  const fetchAssignedPolicies = async () => {
    setLoadingPolicies(true);
    setPoliciesError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/policies/assigned-to-me`, { headers: authHeader });
      setAssignedPolicies(response.data);
    } catch (err) {
      console.error("Failed to load assigned policies:", err);
      setPoliciesError("Failed to load assigned policy guidelines.");
    } finally {
      setLoadingPolicies(false);
    }
  };

  useEffect(() => {
    fetchViolations();
    fetchAssignedPolicies();
  }, [employeeEmail]);

  // Compute a personal compliance score based on task completions and alerts
  const personalComplianceScore = useMemo(() => {
    const uncompletedTasksCount = tasks.filter(t => !t.completed).length;
    const activeViolationsCount = violations.filter(v => v.status === 'OPEN' || v.status === 'IN_PROGRESS' || v.status === 'REQUIRES_CHANGES').length;
    const unsignedPoliciesCount = assignedPolicies.filter(p => p.status !== 'SIGNED').length;
    
    // Base 100, deduct points
    const score = 100 - (uncompletedTasksCount * 5) - (activeViolationsCount * 12) - (unsignedPoliciesCount * 8);
    return Math.max(0, score);
  }, [tasks, violations, assignedPolicies]);

  const toggleTask = (taskId) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, completed: !t.completed };
      }
      return t;
    }));
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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">AI Compliance Portal</h2>
                <span className="bg-amber-500/15 text-amber-400 text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase border border-amber-500/25 tracking-wider font-mono">Demo Environment</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Employee Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Employee tag */}
            {user?.company_name && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-indigo-400">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                <span>{user.company_name}</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>{employeeEmail}</span>
              <span className="text-[9px] bg-indigo-500/15 text-indigo-400 font-extrabold px-1.5 py-0.5 rounded border border-indigo-500/25 uppercase">{user?.rawRole || user?.role || 'Employee'}</span>
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
              Welcome back, {user?.name || 'Ross'}!
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-medium">Here is your personal compliance assessment profile and policy tasks registry.</p>
          </div>
          <div className="flex gap-4 text-xs font-semibold text-slate-400">
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-500">Corporate Domain</span>
              <span className="text-slate-200 mt-0.5 block">{user?.email?.split('@')[1] || 'security-hq.com'}</span>
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
                  : '🟡 Attention required. Review outstanding training tasks and sign policy pledges to resolve risk flags.'}
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

        {/* Company Policies & Acknowledgment Pledge */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0b0f1a] border border-slate-800/80 shadow-md">
          <div className="mb-5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Electronic Signature</span>
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              Corporate Compliance Policies & Pledges
              <Lock className="w-4.5 h-4.5 text-indigo-400" />
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              You are legally required to review active corporate policy documents and submit an electronic sign-off.
            </p>
          </div>

          {/* List items */}
          {loadingPolicies ? (
            <div className="flex items-center gap-3 justify-center py-8">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <span className="text-xs font-semibold text-slate-400">Syncing assigned pledges...</span>
            </div>
          ) : policiesError ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs text-center">
              {policiesError}
            </div>
          ) : assignedPolicies.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-slate-850 rounded-2xl italic text-xs">
              No active corporate policies assigned to your account.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedPolicies.map((policy) => {
                const isSigned = policy.status === 'SIGNED';
                const isOverdue = policy.status === 'OVERDUE';
                
                return (
                  <div 
                    key={policy.policy_id}
                    className="p-5 rounded-2xl bg-[#0f172a]/30 border border-slate-850 hover:border-slate-800 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded border text-[9px] font-extrabold tracking-wider uppercase",
                          isSigned 
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                            : isOverdue 
                              ? 'bg-red-500/10 border-red-500/25 text-red-400 animate-pulse'
                              : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                        )}>
                          {policy.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">v{policy.version}</span>
                      </div>
                      
                      <h4 className="text-sm font-extrabold text-white mb-1">
                        {policy.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        ID: {policy.policy_id} • Due: {policy.acknowledgment_due_date}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-slate-850 pt-3 flex justify-between items-center gap-2">
                      <span className="text-[9px] text-slate-500 truncate max-w-[150px] font-mono">
                        {policy.document_sha256.slice(0, 16)}...
                      </span>
                      
                      <button
                        onClick={() => setSelectedPolicyForSign(policy)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 select-none",
                          isSigned
                            ? "bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800"
                            : "bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 hover:text-white text-indigo-400"
                        )}
                      >
                        {isSigned ? 'View Signed Receipt' : 'Review & E-Sign'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
          {loadingViolations ? (
            <div className="flex items-center gap-3 justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <span className="text-sm font-semibold text-slate-400">Syncing security registry...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-sm text-center">
              {error}
            </div>
          ) : violations.length === 0 ? (
            <div className="p-12 text-center text-slate-500 border border-slate-850 rounded-2xl italic text-sm">
              🎉 Congratulations! No active compliance violations assigned to you.
            </div>
          ) : (
            <div className="space-y-4">
              {violations.map((violation) => {
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
                        <span className="text-[10px] text-slate-500 font-semibold uppercase font-mono font-bold">ID: #{violation.id}</span>
                        <span className="text-slate-700">•</span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase",
                          violation.status === 'RESOLVED' ? 'text-emerald-400' : 'text-amber-450'
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
                      {violation.sla && (
                        <div className="w-full max-w-md mt-2">
                          <SLAStatusIndicator sla={violation.sla} severity={violation.severity} />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedViolation(violation)}
                      className="px-4 py-2 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 select-none flex-shrink-0"
                    >
                      View Details & Mitigate
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Drill-down Modal details pop-up */}
      {selectedViolation && (
        <MitigationModal
          violation={selectedViolation}
          user={user}
          onClose={() => setSelectedViolation(null)}
          onStatusChanged={fetchViolations}
        />
      )}

      {/* Policy Sign-Off modal details pop-up */}
      {selectedPolicyForSign && (
        <PolicyAcknowledgmentModal
          policy={selectedPolicyForSign}
          user={user}
          onClose={() => setSelectedPolicyForSign(null)}
          onAcknowledged={fetchAssignedPolicies}
        />
      )}
    </div>
  );
}
