import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  X, ShieldAlert, CheckCircle2, Lock, Loader2, Download, AlertTriangle, FileText, Info
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import html2pdf from 'html2pdf.js';

const BACKEND_URL = 'http://127.0.0.1:8000/api';

export default function PolicyAcknowledgmentModal({ policy, user, onClose, onAcknowledged }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Signature form states
  const [consentChecked, setConsentChecked] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [typedSignature, setTypedSignature] = useState('');
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  
  // Confirmation state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Success receipt state
  const [receipt, setReceipt] = useState(null);
  
  const scrollRef = useRef(null);

  // Derive legal name
  const expectedLegalName = user?.name || 'Ross';

  const authHeader = useMemo(() => {
    const email = user?.email || 'employee.ross@security-hq.com';
    const role = user?.role || 'Employee';
    return { Authorization: `Bearer ${email}:${role}` };
  }, [user]);

  // Track if scrolled to bottom on mount/scroll
  const handleScroll = (e) => {
    const target = e.target;
    // Check if scrolled within 10px of bottom
    const threshold = 10;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + threshold;
    if (isAtBottom) {
      setHasReadToBottom(true);
    }
  };

  // Safe check if content is small and doesn't require scroll
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollHeight <= el.clientHeight) {
        setHasReadToBottom(true);
      }
    }
  }, [policy]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/policies/${policy.policy_id}/acknowledge`,
        {
          typed_signature: typedSignature,
          electronic_consent: consentChecked,
          acknowledged_reading: confirmChecked
        },
        { headers: authHeader }
      );
      setReceipt(response.data);
      setShowConfirmDialog(false);
      if (onAcknowledged) {
        onAcknowledged();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Electronic signing failed. Please verify signature matching.');
      setShowConfirmDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = () => {
    if (!receipt) return;
    const element = document.getElementById('acknowledgment-receipt-pdf');
    if (!element) return;

    const opt = {
      margin: 0.5,
      filename: `Receipt_${receipt.acknowledgment_id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-sm select-none">
      
      {/* Outer Card Container */}
      <div className="relative w-full max-w-2xl bg-[#0b0f1a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-[#e2e8f0]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-[#0f172a]/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Secure Electronic Acknowledgment</h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Defensible E-Signature System</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Screens */}
        {!receipt ? (
          <>
            {/* View 1: Signing inputs and policy reader */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              
              {/* Alert Warning */}
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 text-indigo-300 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-normal font-medium">
                  <span className="font-extrabold text-white block mb-0.5">Signature Requirement Notice</span>
                  You are reviewing version <strong className="text-indigo-300">{policy.version}</strong> of this document. Scroll through the rules text below to authorize your sign-off controls.
                </div>
              </div>

              {/* Policy Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#090d16] border border-slate-800/80 rounded-2xl text-xs font-semibold text-slate-400">
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-500">Document ID / Version</span>
                  <span className="text-slate-200 mt-0.5 block font-mono">{policy.policy_id} (v{policy.version})</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-500">Effective Date</span>
                  <span className="text-slate-200 mt-0.5 block">{policy.effective_date}</span>
                </div>
                <div className="col-span-2 border-t border-slate-850 pt-2.5 mt-1">
                  <span className="block text-[9px] uppercase font-bold text-slate-500">SHA-256 Checksum</span>
                  <span className="text-[10px] text-slate-300 font-mono mt-0.5 block truncate" title={policy.document_sha256}>
                    {policy.document_sha256}
                  </span>
                </div>
              </div>

              {/* Scrollable Policy Text */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase text-slate-400 block">Policy Clauses</label>
                <div 
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="h-48 overflow-y-auto p-4 rounded-2xl bg-[#070b13] border border-slate-850 text-xs text-slate-300 font-medium leading-relaxed scrollbar-thin select-text"
                >
                  <div className="whitespace-pre-wrap font-sans">{policy.content}</div>
                </div>
                {!hasReadToBottom && (
                  <span className="text-[10px] text-indigo-400 font-bold block animate-pulse">
                    ⚠️ Please scroll to the end of the text to unlock signature fields.
                  </span>
                )}
              </div>

              {/* Signing controls */}
              <div className={cn(
                "space-y-4 pt-4 border-t border-slate-800 transition-opacity duration-300",
                hasReadToBottom ? "opacity-100" : "opacity-40 pointer-events-none"
              )}>
                {/* Error Banner */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl font-bold">
                    {error}
                  </div>
                )}

                {/* Consent Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    disabled={!hasReadToBottom}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                  />
                  <span className="text-xs text-slate-300 font-semibold select-none leading-normal">
                    I agree to use electronic records and signatures for this policy acknowledgment.
                  </span>
                </label>

                {/* Confirmed Reading Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    disabled={!hasReadToBottom}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                  />
                  <span className="text-xs text-slate-300 font-semibold select-none leading-normal">
                    I confirm that I have read and understood this policy version.
                  </span>
                </label>

                {/* Signature input */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-extrabold uppercase text-slate-400 block flex justify-between">
                    <span>E-Signature (Type Legal Name)</span>
                    <span className="text-slate-500">Legal: <strong className="text-slate-300">{expectedLegalName}</strong></span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={`Type "${expectedLegalName}" to sign`}
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    disabled={!hasReadToBottom}
                    className="w-full px-4 py-3 bg-[#090d16] border border-slate-800 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-800 bg-[#0f172a]/20 flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-4.5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowConfirmDialog(true)}
                disabled={!hasReadToBottom || !consentChecked || !confirmChecked || typedSignature.trim() === ''}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer select-none"
              >
                Electronically Sign & Acknowledge
              </button>
            </div>
          </>
        ) : (
          <>
            {/* View 2: Successful sign-off and receipt card */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              
              {/* Success Badge */}
              <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6 animate-bounce" />
                </div>
                <h4 className="text-lg font-extrabold text-white">Acknowledgment Completed</h4>
                <p className="text-xs text-slate-400 max-w-sm">Your electronic acknowledgment has been securely generated and registered in the audit registry.</p>
              </div>

              {/* Receipt Area (Hidden printable copy for PDF generation) */}
              <div className="p-6 rounded-2xl bg-white text-slate-800 border border-slate-200 space-y-4" id="acknowledgment-receipt-pdf">
                <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Security-HQ Compliance Portal</h3>
                    <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">ELECTRONIC SIGN-OFF RECEIPT</p>
                  </div>
                  <span className="px-2.5 py-1 text-[9px] font-extrabold tracking-wider bg-emerald-100 text-emerald-800 rounded border border-emerald-200 uppercase">
                    {receipt.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Acknowledgment ID</span>
                    <span className="text-slate-900 font-mono mt-0.5 block">{receipt.acknowledgment_id}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Signed Time (UTC)</span>
                    <span className="text-slate-900 mt-0.5 block">{receipt.signed_at}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Signer Profile</span>
                    <span className="text-slate-900 mt-0.5 block">{receipt.employee_name} ({receipt.employee_id})</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Registered Email</span>
                    <span className="text-slate-900 mt-0.5 block">{receipt.employee_email}</span>
                  </div>
                  <div className="col-span-2 border-t border-slate-100 pt-2.5">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Policy Title & Version</span>
                    <span className="text-slate-900 mt-0.5 block font-bold">{policy.title} ({receipt.policy_version})</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Digital Fingerprint (SHA-256)</span>
                    <span className="text-[10px] text-slate-600 font-mono mt-0.5 block truncate" title={receipt.policy_document_sha256}>
                      {receipt.policy_document_sha256}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Signature Consent IP</span>
                    <span className="text-slate-900 mt-0.5 block font-mono">{receipt.signed_ip_address}</span>
                  </div>
                  <div className="col-span-2 border-t border-slate-100 pt-2.5">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Tamper-Evident Receipt Hash</span>
                    <span className="text-[10px] text-slate-600 font-mono mt-0.5 block break-all font-bold">
                      {receipt.receipt_hash}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 text-[8px] text-slate-400 text-center leading-normal font-medium">
                  This document constitutes a binding record of electronic acknowledgment under standard identity verification and organization policy rules.
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3.5 bg-slate-900/65 rounded-xl border border-slate-850">
                <p className="text-[9px] text-slate-500 leading-relaxed font-semibold">
                  ⚖️ <strong className="text-slate-400">Compliance Disclaimer:</strong> This feature creates an auditable electronic acknowledgment. Legal enforceability depends on applicable law, identity verification, consent requirements, and organization policy.
                </p>
              </div>
            </div>

            {/* Success Actions */}
            <div className="p-6 border-t border-slate-800 bg-[#0f172a]/20 flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-4.5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Close Portal
              </button>
              <button 
                onClick={downloadReceipt}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer select-none"
              >
                <Download className="w-4 h-4" /> Download Acknowledgment Receipt
              </button>
            </div>
          </>
        )}
      </div>

      {/* Embedded confirmation sub-modal */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
          <div className="w-full max-w-md p-6 bg-[#0b0f1a] border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex gap-3 items-start">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400 flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">Verify Your Electronic Signature</h4>
                <p className="text-xs text-slate-400 mt-1 leading-normal">Please confirm the correctness of your sign-off details before saving them permanently to the corporate audit ledger.</p>
              </div>
            </div>

            <div className="p-4 bg-[#090d16] border border-slate-850 rounded-xl space-y-2 text-xs font-semibold text-slate-400">
              <div className="flex justify-between">
                <span className="text-slate-500">Signer:</span>
                <span className="text-slate-200">{expectedLegalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Document:</span>
                <span className="text-slate-200 truncate max-w-[200px]">{policy.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Version:</span>
                <span className="text-slate-200">{policy.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Signing Time:</span>
                <span className="text-indigo-400 font-mono">Current Server UTC</span>
              </div>
            </div>

            <div className="p-3 bg-red-500/5 border border-red-500/20 text-red-400 rounded-xl text-[10px] leading-normal font-bold">
              ⚠️ Warning: Once verified, this signature record becomes tamper-evident and cannot be updated, removed, or signed again for this version.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-850 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Signature'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
