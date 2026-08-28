import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, Lock, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Mail } from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function EmployeeNotificationModal({ violationId, user, onClose, onSuccess }) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState('');

  const authHeader = useMemo(() => {
    if (!user || !user.token) return {};
    return { Authorization: `Bearer ${user.token}` };
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      setLoadingPreview(true);
      setError('');
      try {
        const response = await axios.get(
          `${BACKEND_URL}/violations/${violationId}/employee-preview`,
          { headers: authHeader }
        );
        if (isMounted) {
          setPreviewData(response.data);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to fetch notification preview:", err);
          setError(err.response?.data?.detail || "Could not resolve assigned employee details from directory.");
        }
      } finally {
        if (isMounted) {
          setLoadingPreview(false);
        }
      }
    };

    if (violationId) {
      fetchPreview();
    }
    return () => { isMounted = false; };
  }, [violationId, authHeader]);

  const handleConfirmSend = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await axios.post(
        `${BACKEND_URL}/violations/${violationId}/notify-employee`,
        {},
        { headers: authHeader }
      );
      if (onSuccess) {
        onSuccess(response.data.message || "Notification sent successfully.");
      }
      onClose();
    } catch (err) {
      console.error("Failed to send employee notification:", err);
      setError(err.response?.data?.detail || "Failed to deliver employee notification.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-lg bg-[#0b0f1a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-[#e2e8f0]">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-[#0f172a]/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Notify Assigned Employee</h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">HR Compliance Notification Dispatch</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {loadingPreview ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs font-semibold">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <span>Resolving employee directory & notification parameters...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="block font-extrabold text-white">Resolution Error</span>
                <span className="block text-red-300 font-medium leading-relaxed">{error}</span>
              </div>
            </div>
          ) : previewData ? (
            <>
              {/* Employee & Item Specs */}
              <div className="p-4 bg-[#090d16] border border-slate-800 rounded-2xl space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Assigned Employee</span>
                    <span className="text-white font-extrabold block mt-0.5">{previewData.employee.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono block">{previewData.employee.employee_id}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Masked Work Email</span>
                    <span className="text-indigo-300 font-mono font-bold block mt-0.5 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-indigo-400 inline" />
                      {previewData.employee.masked_email}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-850 pt-2.5 grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Policy Item</span>
                    <span className="text-slate-200 font-semibold block mt-0.5 truncate" title={previewData.policy_name}>
                      {previewData.policy_name}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Due Date</span>
                    <span className="text-amber-400 font-bold block mt-0.5">{previewData.due_date}</span>
                  </div>
                </div>

                <div className="border-t border-slate-850 pt-2.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-500">Required Action</span>
                  <span className="text-slate-300 font-medium block mt-0.5">{previewData.required_action}</span>
                </div>
              </div>

              {/* Privacy Assurance Note */}
              <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-300 font-medium leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-white block mb-0.5">Privacy Assurance Enforced</span>
                  Raw system logs, detailed evidence snippets, salary, and personal demographic attributes are strictly excluded from employee emails.
                </div>
              </div>

              {/* Email Content Preview */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">Neutral Email Preview</span>
                <div className="p-4 bg-[#070b13] border border-slate-850 rounded-2xl space-y-2 text-xs font-mono text-slate-300">
                  <div className="text-indigo-400 font-semibold border-b border-slate-800 pb-1.5 truncate">
                    Subject: {previewData.neutral_subject}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-300 text-[11px] leading-relaxed pt-1">
                    {previewData.preview_body}
                  </pre>
                </div>
              </div>

              {/* Cooldown Warning if active */}
              {previewData.cooldown_active && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold">
                  ⚠️ A notification was recently sent to this employee. Please wait before dispatching another notification.
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-[#0f172a]/30 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4.5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleConfirmSend}
            disabled={submitting || loadingPreview || !previewData || previewData?.cooldown_active}
            className={cn(
              "px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer select-none",
              (submitting || loadingPreview || !previewData || previewData?.cooldown_active) && "opacity-40 pointer-events-none"
            )}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Dispatching...</>
            ) : (
              <><Send className="w-4 h-4" /> Confirm & Send Notification</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
