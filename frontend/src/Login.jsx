import React, { useState } from 'react';
import { 
  Eye, EyeOff, Mail, Lock, Loader2, Sparkles, 
  ArrowRight, ShieldCheck, ShieldAlert, ArrowLeft, Building, Users
} from 'lucide-react';
import { cn } from './lib/utils';

export default function Login({ onLogin, onBack, onSetupOrg, initialCredentials }) {
  const [activeTab, setActiveTab] = useState('employee'); // 'employee' | 'hr'
  const [email, setEmail] = useState(initialCredentials?.email || '');
  const [password, setPassword] = useState(initialCredentials?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  // Form input validation
  const validateForm = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      errors.email = 'Work email is required';
    } else if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid work email';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.detail || 'Incorrect work email or password.');
        return;
      }

      onLogin(data);
    } catch (err) {
      setLoading(false);
      setError('Connection to compliance authentication server failed.');
    }
  };

  // Populate demo credentials into form inputs and automatically authenticate
  const handleSelectDemoAccount = async (credentials) => {
    setError('');
    setEmail(credentials.email);
    setPassword(credentials.password);
    if (credentials.roleType) {
      setActiveTab(credentials.roleType);
    }
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.detail || 'Incorrect work email or password.');
        return;
      }

      onLogin(data);
    } catch (err) {
      setLoading(false);
      setError('Connection to compliance authentication server failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-[#e2e8f0] font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Decorative neon backdrops */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/5 blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button 
        onClick={onBack}
        disabled={loading}
        className="absolute top-6 left-6 text-slate-400 hover:text-white px-4 py-2 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700/60 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs font-semibold"
      >
        <ArrowLeft className="w-4 h-4" /> Return to Site
      </button>

      {/* Main card */}
      <div className="bg-[#0b0f19]/90 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden transition-all duration-300">
        
        {/* Top Glow bar depending on active role */}
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 h-1 transition-all duration-500",
            activeTab === 'employee' ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
          )} 
        />

        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 mb-3">
            <Building className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">AI Compliance Portal</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Enterprise Security & Audit Management</p>
        </div>

        {/* Portal selector tabs */}
        <div className="flex bg-[#030712] rounded-2xl border border-slate-800/80 p-1 mb-6">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setActiveTab('employee');
              setError('');
              setValidationErrors({});
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === 'employee' 
                ? "bg-indigo-600 border border-indigo-500 text-white shadow-lg shadow-indigo-500/25" 
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Users className="w-4 h-4" />
            Employee
          </button>
          
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setActiveTab('hr');
              setError('');
              setValidationErrors({});
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeTab === 'hr' 
                ? "bg-purple-600 border border-purple-500 text-white shadow-lg shadow-purple-500/25" 
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Compliance Officer
          </button>
        </div>

        {/* Portal dynamic descriptions */}
        <div className="bg-[#0f172a]/30 border border-slate-800/50 rounded-2xl p-4 mb-6 text-xs leading-relaxed text-slate-400">
          {activeTab === 'employee' ? (
            <p>
              <strong className="text-indigo-400 block mb-0.5 font-bold">Standard Employee Access:</strong>
              View personal compliance scores, track outstanding security training modules, sign corporate codes of conduct, and review personal violation flags.
            </p>
          ) : (
            <p>
              <strong className="text-purple-400 block mb-0.5 font-bold">Compliance Officer & HR Access:</strong>
              Review organization-wide violations, run audits on log uploads, manage policy documents, view comparison metrics, and manage SLA deadlines.
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Work Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
              <input
                type="email"
                placeholder={activeTab === 'employee' ? 'employee@technova-demo.com' : 'hr@technova-demo.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={cn(
                  "w-full bg-[#030712] border rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 placeholder-slate-600 transition-all font-medium focus:border-indigo-500 focus:ring-indigo-500/20",
                  validationErrors.email 
                    ? "border-red-500 focus:ring-red-500/50" 
                    : activeTab === 'employee' 
                      ? "border-slate-800 focus:ring-indigo-500/50 focus:border-indigo-500" 
                      : "border-slate-800 focus:ring-purple-500/50 focus:border-purple-500"
                )}
              />
            </div>
            {validationErrors.email && (
              <span className="text-[10px] font-bold text-red-400 block">{validationErrors.email}</span>
            )}
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Password</label>
              <span className="text-[10px] font-semibold text-slate-500 hover:text-indigo-400 cursor-pointer">Forgot?</span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={cn(
                  "w-full bg-[#030712] border rounded-xl pl-10 pr-10 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 placeholder-slate-600 transition-all font-medium focus:border-indigo-500 focus:ring-indigo-500/20",
                  validationErrors.password 
                    ? "border-red-500 focus:ring-red-500/50" 
                    : activeTab === 'employee' 
                      ? "border-slate-800 focus:ring-indigo-500/50 focus:border-indigo-500" 
                      : "border-slate-800 focus:ring-purple-500/50 focus:border-purple-500"
                )}
              />
              <button
                type="button"
                tabIndex="-1"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {validationErrors.password && (
              <span className="text-[10px] font-bold text-red-400 block">{validationErrors.password}</span>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full py-3.5 rounded-xl font-bold text-sm text-white flex justify-center items-center gap-2 transition-all cursor-pointer disabled:opacity-50 select-none shadow-lg mt-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
              activeTab === 'employee' 
                ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10" 
                : "bg-purple-600 hover:bg-purple-700 shadow-purple-500/10"
            )}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating via SSO...</>
            ) : (
              <span className="flex items-center gap-1.5">
                Sign In to Compliance <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800/80"></div></div>
          <span className="relative bg-[#0b0f19] px-3 text-[9px] uppercase font-extrabold tracking-widest text-slate-500">
            Demo Access (Populates Form)
          </span>
        </div>

        {/* Demo Account Bypasses */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelectDemoAccount({ email: 'hr@technova-demo.com', password: 'passwordA123', roleType: 'hr' })}
            className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 text-left transition-all cursor-pointer"
          >
            <span className="font-extrabold text-white block truncate">TechNova HR</span>
            <span className="text-[8px] text-slate-400 block truncate">hr@technova-demo.com</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelectDemoAccount({ email: 'compliance@aegispoint-demo.com', password: 'passwordB123', roleType: 'hr' })}
            className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 text-left transition-all cursor-pointer"
          >
            <span className="font-extrabold text-white block truncate">AegisPoint Compliance</span>
            <span className="text-[8px] text-slate-400 block truncate">compliance@aegispoint-demo.com</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelectDemoAccount({ email: 'employee@technova-demo.com', password: 'passwordA123', roleType: 'employee' })}
            className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 text-left transition-all cursor-pointer"
          >
            <span className="font-extrabold text-white block truncate">TechNova Employee</span>
            <span className="text-[8px] text-slate-400 block truncate">employee@technova-demo.com</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelectDemoAccount({ email: 'multitenant.hr@enterprise-demo.com', password: 'passwordMulti123', roleType: 'hr' })}
            className="p-2.5 rounded-xl bg-slate-900/60 border border-purple-500/30 bg-purple-500/5 hover:border-purple-500/60 text-left transition-all cursor-pointer"
          >
            <span className="font-extrabold text-purple-300 block truncate">Multi-Tenant HR</span>
            <span className="text-[8px] text-slate-400 block truncate">2 Authorized Orgs</span>
          </button>
        </div>

        {/* Organization Setup Onboarding link */}
        {onSetupOrg && (
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={onSetupOrg}
              className="text-xs font-extrabold text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Building className="w-3.5 h-3.5" /> Need a new tenant? Onboard Organization →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}