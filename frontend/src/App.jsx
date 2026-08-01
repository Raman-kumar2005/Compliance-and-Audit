import React, { useState } from 'react';
import Login from './Login';
import { 
  Upload, AlertTriangle, ShieldAlert, FileText, Loader2, 
  Sparkles, CheckCircle2, Download, Search, Filter 
} from 'lucide-react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [policyFile, setPolicyFile] = useState(null);
  const [logFile, setLogFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [error, setError] = useState('');
  
  // Interactive Filters State
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const BACKEND_URL = 'https://compliance-and-audit.onrender.com/api/audit';;

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const handleAudit = async () => {
    if (!policyFile || !logFile) {
      setError('Please select both a Policy document and a Log file.');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('policy_file', policyFile);
    formData.append('log_file', logFile);

    try {
      const response = await axios.post(BACKEND_URL, formData);
      const violations = response.data.violations || response.data;
      setAuditData(Array.isArray(violations) ? violations : []);
    } catch (err) {
      console.error("Audit request failed:", err);
      setError(err.response?.data?.detail || 'Backend connection failed. Displaying mock preview data.');
      setAuditData(MOCK_RESULTS);
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    setError('');
    setAuditData(MOCK_RESULTS);
  };

  const exportPDF = () => {
    const element = document.getElementById('report-container');
    const opt = {
      margin:       0.5,
      filename:     'AI_Compliance_Audit_Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  // Filter & Search Evaluation
  const filteredData = auditData ? auditData.filter(item => {
    const matchesSeverity = filterSeverity === 'ALL' || item.severity === filterSeverity;
    const matchesSearch = 
      item.rule_violated.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.log_entry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.explanation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  }) : [];

  const highSeverityCount = auditData ? auditData.filter(item => item.severity === 'HIGH').length : 0;
  
  // 1. Group the violations by rule_violated and count them
  const violationCounts = auditData?.reduce((acc, curr) => {
    const rule = curr.rule_violated;
    acc[rule] = (acc[rule] || 0) + 1;
    return acc;
  }, {});

  // 2. Format the data for Recharts
  const chartColors = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];
  const pieChartData = Object.keys(violationCounts || {}).map((key, index) => ({
    name: key,
    value: violationCounts[key],
    color: chartColors[index % chartColors.length]
  }));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      {/* Header */}
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 text-indigo-400">
            <ShieldAlert className="w-8 h-8 text-indigo-400" /> Enterprise AI Compliance Auditor
          </h1>
          <p className="text-slate-400 mt-1">Instant policy violation detection & automated log risk analysis.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={loadDemoData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-sm font-semibold border border-indigo-500/30 flex items-center gap-2 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" /> Load Demo Preview Data
          </button>
          
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-red-400 rounded-lg text-sm font-semibold border border-red-500/30 transition cursor-pointer"
          >
            Logout
          </button>
        </div>
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
      {auditData && auditData.length > 0 && (
        <div className="mt-12 space-y-8" id="report-container">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 shadow-md">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Flags Detected</span>
              <p className="text-3xl font-extrabold text-white mt-1">{auditData.length}</p>
            </div>
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 shadow-md">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">High Risk Breaches</span>
              <p className="text-3xl font-extrabold text-red-400 mt-1">{highSeverityCount}</p>
            </div>
            <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 shadow-md">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Compliance Status</span>
              <p className="text-3xl font-extrabold text-amber-400 mt-1">
                {highSeverityCount > 0 ? "Action Required" : "Under Review"}
              </p>
            </div>
          </div>

          {/* --- PIE CHART SECTION --- */}
          {pieChartData.length > 0 && (
            <div className="bg-slate-800/90 p-6 rounded-2xl border border-slate-700 shadow-md">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Violation Breakdown</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                      itemStyle={{ color: '#cbd5e1' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Search, Filter & PDF Export Bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search violations or log keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Severity Filters */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterSeverity(level)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterSeverity === level 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>

            {/* Export PDF Button */}
            <button
              onClick={exportPDF}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" /> Export PDF Report
            </button>
          </div>

          {/* Violation Report Cards */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-slate-100 flex items-center gap-2">
              <AlertTriangle className="text-amber-400" /> Policy Violation Report
            </h2>
            
            {filteredData.length === 0 ? (
              <p className="text-slate-400 text-sm italic p-4 bg-slate-800/40 rounded-xl">
                No violations match the selected search or filter criteria.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredData.map((item, index) => (
                  <div key={item.id || index} className="bg-slate-800/90 p-6 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col md:flex-row justify-between gap-6">
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
            )}
          </div>
        </div>
      )}

      {/* Clean State */}
      {auditData && auditData.length === 0 && (
        <div className="mt-8 p-6 bg-slate-800/80 rounded-2xl border border-emerald-500/40 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-emerald-400 font-bold text-lg">
            No Policy Violations Detected!
          </p>
          <p className="text-slate-400 text-sm mt-1">
            All system logs strictly comply with corporate policies.
          </p>
        </div>
      )}
    </div>
  );
}