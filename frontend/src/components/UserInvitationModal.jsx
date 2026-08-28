import React, { useState, useEffect } from 'react';
import { Mail, UserPlus, X, CheckCircle2, ShieldAlert, Loader2, Users, Building, ShieldCheck } from 'lucide-react';

export default function UserInvitationModal({ user, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Employee');
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  const authHeader = { Authorization: `Bearer ${user.token}` };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/hr/invitations`, { headers: authHeader });
      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!email) return;

    setError('');
    setSuccess('');
    setSending(true);

    try {
      const response = await fetch(`${BACKEND_URL}/hr/invite-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ email, role })
      });

      const data = await response.json();
      setSending(false);

      if (!response.ok) {
        setError(data.detail || 'Failed to send invitation.');
        return;
      }

      setSuccess(`Invitation successfully dispatched to ${email}!`);
      setEmail('');
      fetchInvitations();
    } catch (err) {
      setSending(false);
      setError('Connection to server failed.');
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#020617]/90 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0b0f19] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-6 bg-slate-900/60 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Invite Team Members</h3>
              <p className="text-xs text-slate-400 font-medium">Assign roles & tenant memberships for {user?.company_name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSendInvite} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Work Email *</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#030712] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Assigned Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-semibold"
              >
                <option value="Employee">Employee (Standard View & Tasks)</option>
                <option value="HR Compliance Officer">HR Compliance Officer (Full HR Console)</option>
                <option value="Compliance Officer">Compliance Officer (Audit & SLA Console)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-500/20 flex justify-center items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Dispatching Membership Invite...</>
              ) : (
                <span className="flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" /> Send Invitation
                </span>
              )}
            </button>
          </form>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Organization Membership List</span>
              <span className="text-[10px] text-purple-400 font-mono font-bold">{invitations.length} Total</span>
            </h4>

            {loading ? (
              <div className="p-4 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> Loading invitations...
              </div>
            ) : invitations.length === 0 ? (
              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-center text-slate-500 text-xs italic">
                No external invitations sent yet. Newly invited team members will appear here.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{inv.email}</span>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-mono block mt-0.5">{inv.role}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
