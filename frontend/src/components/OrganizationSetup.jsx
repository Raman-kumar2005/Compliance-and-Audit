import React, { useState } from 'react';
import { Building, Mail, Lock, User, ArrowLeft, ArrowRight, Loader2, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

export default function OrganizationSetup({ onCreated, onBack }) {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [companySize, setCompanySize] = useState('51-200');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName || !adminEmail || !adminPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/organizations/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          industry,
          company_size: companySize,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_name: adminName
        })
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.detail || 'Failed to create organization.');
        return;
      }

      setSuccess(`Organization "${companyName}" created successfully! Redirecting to login...`);
      setTimeout(() => {
        if (onCreated) {
          onCreated({ email: adminEmail, password: adminPassword });
        }
      }, 1500);
    } catch (err) {
      setLoading(false);
      setError('Connection to server failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-[#e2e8f0] font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Glow backdrop */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 text-slate-400 hover:text-white px-4 py-2 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700/60 transition-all flex items-center gap-2 cursor-pointer text-xs font-semibold"
      >
        <ArrowLeft className="w-4 h-4" /> Return to Login
      </button>

      <div className="bg-[#0b0f19]/95 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-purple-400 mb-3">
            <Building className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Onboard New Organization</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Create enterprise compliance tenant & HR admin workspace</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4.5 h-4.5 text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Organization / Company Name *</label>
            <div className="relative">
              <Building className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. TechNova Technologies"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full bg-[#030712] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="Technology">Technology</option>
                <option value="Finance & Banking">Finance & Banking</option>
                <option value="Healthcare & Biotech">Healthcare & Biotech</option>
                <option value="Retail & E-commerce">Retail & E-commerce</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Professional Services">Professional Services</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Company Size</label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="1-50">1-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-1000">201-1,000 employees</option>
                <option value="1000+">1,000+ employees</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-purple-400 block mb-2">HR Administrator Account</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Admin Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. Sarah Jenkins"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full bg-[#030712] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Admin Work Email *</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
              <input
                type="email"
                placeholder="admin@company.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className="w-full bg-[#030712] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Admin Password *</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
              <input
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                className="w-full bg-[#030712] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20 flex justify-center items-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-4"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning Tenant & Workspace...</>
            ) : (
              <span className="flex items-center gap-1.5">
                Create Organization Workspace <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
