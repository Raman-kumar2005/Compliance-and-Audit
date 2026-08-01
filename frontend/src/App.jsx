import React, { useState } from 'react';
import { Upload, AlertTriangle, ShieldAlert, FileText, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';

const MOCK_RESULTS = [
  {
    id: 1,
    rule_violated: "Working Hours Policy (Restricted 22:00 - 06:00)",
    log_entry: "23:10:45 - User: charlie - Action: Remote Server Login",
    severity: "HIGH",
    explanation: "User 'charlie' initiated remote access at 23:10, violating the late-night restriction window.",
    recommendation: "Flag account for security review and audit active session logs."
  },
  {
    id: 2,
    rule_violated: "Unauthorized Data Export Operation",
    log_entry: "14:30:12 - User: bob (Role: USER) - Action: Data Export",
    severity: "HIGH",
    explanation: "User 'bob' has role 'USER' but attempted a restricted export operation reserved strictly for 'ADMIN'.",
    recommendation: "Immediately revoke export privileges for 'bob' and alert system admin."
  },
  {
    id: 3,
    rule_violated: "Financial Approval Threshold Exceeded",
    log_entry: "15:45:00 - User: david - Action: Wire Transfer ($8,500)",
    severity: "MEDIUM",
    explanation: "Transaction amount of $8,500 exceeds the single-user authorization limit of $5,000 without Manager sign-off.",
    recommendation: "Require secondary approval signature from Finance Lead before clearing funds."
  }
];

export default function App() {
  const [policyFile, setPolicyFile] = useState(null);
  const [logFile, setLogFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState([]);
  const [error, setError] = useState('');

  const BACKEND_URL = 'http://localhost:8000/api/audit';

  const handleAudit = async () => {
    if (!policyFile || !logFile) {
      setError('Please select both a Policy PDF and a Log file.');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('policy_file', policyFile);
    formData.append('log_file', logFile);

    try {
      const response = await axios.post(BACKEND_URL, formData);
      setAuditData(response.data);
    } catch (err) {
      setError('Backend connection failed. Displaying mock preview data.');
      setAuditData(MOCK_RESULTS);
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    setError('');
    setAuditData(MOCK_RESULTS);
  };

  const highSeverityCount = auditData.filter(item => item.severity === 'HIGH').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 text-indigo-400">
            <ShieldAlert className="w-8 h-8 text-indigo-400" /> Enterprise AI Compliance Auditor
          </h1>
          <p className="text-slate-400 mt-1">Instant policy violation detection & automated log risk analysis.</p>
        </div>
        <button 
          onClick={loadDemoData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-sm font-semibold border border-indigo-500/30 flex items-center gap-2 transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" /> Load Demo Preview Data
        </button>
      </header>

      {/* Upload Zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/60 shadow-xl">
          <label className="block text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-300">
            <FileText className="w-5 h-5 text-indigo-400" /> Company Policy Document (.pdf, .txt)
          </label>
          <input 
            type="file" 
            accept=".pdf,.txt" 
            onChange={(e) => setPolicyFile(e.target.files[0])}
            className="w-full text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:font-semibold hover:file:bg-indigo-500 cursor-pointer"
          />
          {policyFile && <p className="text-xs text-emerald-400 mt-2">Selected: {policyFile.name}</p>}
        </div>

        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/60 shadow-xl">
          <label className="block text-sm font-semibold mb-3 flex items-center gap-2 text-emerald-300">
            <FileText className="w-5 h-5 text-emerald-400" /> System Logs File (.csv, .txt, .json)
          </label>
          <input 
            type="file" 
            accept=".csv,.txt,.json" 
            onChange={(e) => setLogFile(e.target.files[0])}
            className="w-full text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:text-white file:font-semibold hover:file:bg-emerald-500 cursor-pointer"
          />
          {logFile && <p className="text-xs text-emerald-400 mt-2">Selected: {logFile.name}</p>}
        </div>
      </div>

      <button 
        onClick={handleAudit} 
        disabled={loading}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg flex justify-center items-center gap-3 transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
      >
        {loading ? (
          <><Loader2 className="animate-spin w-6 h-6" /> Running Compliance Engine...</>
        ) : (
          <><Upload className="w-6 h-6" /> Run Audit Scan</>
        )}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-amber-950/60 border border-amber-600/60 text-amber-200 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" /> {error}
        </div>
      )}

      {/* Results Dashboard */}
      {auditData.length > 0 && (
        <div className="mt-12 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Flags Detected</span>
              <p className="text-3xl font-extrabold text-white mt-1">{auditData.length}</p>
            </div>
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">High Risk Breaches</span>
              <p className="text-3xl font-extrabold text-red-400 mt-1">{highSeverityCount}</p>
            </div>
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Compliance Status</span>
              <p className="text-3xl font-extrabold text-amber-400 mt-1">Action Required</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4 text-slate-100 flex items-center gap-2">
              <AlertTriangle className="text-amber-400" /> Policy Violation Report
            </h2>
            <div className="space-y-4">
              {auditData.map((item) => (
                <div key={item.id} className="bg-slate-800/90 p-6 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${
                        item.severity === 'HIGH' ? 'bg-red-900/60 text-red-300 border-red-600' :
                        item.severity === 'MEDIUM' ? 'bg-amber-900/60 text-amber-300 border-amber-600' :
                        'bg-blue-900/60 text-blue-300 border-blue-600'
                      }`}>
                        {item.severity} SEVERITY
                      </span>
                      <h3 className="font-bold text-lg text-slate-100">{item.rule_violated}</h3>
                    </div>
                    <p className="text-sm text-slate-300">
                      <strong className="text-slate-400">Log Evidence:</strong> <code className="bg-slate-950 px-2.5 py-1 rounded-md text-emerald-400 font-mono text-xs">{item.log_entry}</code>
                    </p>
                    <p className="text-sm text-slate-300">
                      <strong className="text-slate-400">Analysis:</strong> {item.explanation}
                    </p>
                  </div>
                  
                  <div className="md:w-72 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 flex flex-col justify-center">
                    <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1">Recommended Action</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}