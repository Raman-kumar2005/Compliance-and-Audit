import React, { useState, useEffect, useMemo } from 'react';
import AuditComparison from './components/AuditComparison';
import RiskScoreCard from './components/RiskScoreCard';
import ComplianceBreakdownCard from './components/ComplianceBreakdownCard';
import AISummaryBox from './components/AISummaryBox';
import DrillDownModal from './components/DrillDownModal';
import FrequentPoliciesCard from './components/FrequentPoliciesCard';
import { 
  Upload, AlertTriangle, ShieldAlert, FileText, Loader2, 
  Sparkles, Download, Search, 
  ArrowRight, FileSpreadsheet, History, PlusCircle, ArrowLeft, Clock, LogOut, GitCompare,
  ArrowUpDown, User
} from 'lucide-react';
import axios from 'axios';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, LineChart, Line, ResponsiveContainer 
} from 'recharts';
import html2pdf from 'html2pdf.js';

const MOCK_RESULTS = {
  metrics: {
    compliance_score: 84,
    risk_distribution: { Low: 24, Medium: 12, High: 6, Critical: 58 },
    violations_by_department: { Finance: 6, HR: 3, IT: 9, Sales: 34, Ops: 2 },
    compliance_trend: [71, 74, 76, 79, 81, 84]
  },
  violations: [
    {
      id: 1,
      employee: "3428",
      department: "Sales",
      rule_violated: "Policy 4.3 - Training Completion Requirements",
      log_entry: "Employee ID: 3428, DepartmentType: Sales, Training Date: 24-Feb-23",
      severity: "Medium",
      explanation: "Employee 3428's training was marked 'Incomplete' on 24-Feb-2023. Exceeds the 60-day requirement.",
      recommendation: "Immediately schedule mandatory retake."
    }
  ]
};

const RISK_COLORS = {
  Low: '#10b981',      
  Medium: '#f59e0b',   
  High: '#f97316',     
  Critical: '#ef4444'  
};

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('new_audit'); // 'new_audit', 'history', 'compare', 'report'
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [policyFile, setPolicyFile] = useState(null);
  const [logFile, setLogFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [error, setError] = useState('');
  
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByField, setSortByField] = useState('severity');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [mitigationStatus, setMitigationStatus] = useState('OPEN');
  const [mitigationNotes, setMitigationNotes] = useState('');
  const [savingMitigation, setSavingMitigation] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [simulatedState, setSimulatedState] = useState('actual'); // 'actual' | 'high-risk'

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/history`);
      setHistoryData(response.data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

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
    if (user?.email) {
      formData.append('hr_email', user.email);
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/audit`, formData);
      const data = response.data;
      if (data.metrics && data.violations) {
        setAuditData(data);
      } else if (Array.isArray(data.violations)) {
        setAuditData({ metrics: MOCK_RESULTS.metrics, violations: data.violations });
      } else {
        setAuditData({ metrics: MOCK_RESULTS.metrics, violations: data });
      }
      setActiveTab('report');
    } catch (err) {
      console.error("Audit request failed:", err);
      setError(err.response?.data?.detail || 'Backend connection failed. Displaying mock preview data.');
      setAuditData(MOCK_RESULTS);
      setActiveTab('report');
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    setError('');
    setAuditData(MOCK_RESULTS);
    setActiveTab('report');
  };

  const viewHistoricalReport = (record) => {
    setAuditData(record);
    setActiveTab('report');
  };

  const exportPDF = () => {
    if (!auditData) return;
    setPdfGenerating(true);
    
    const element = document.getElementById('report-container');
    const opt = {
      margin:       0.3,
      filename:     `Compliance_Audit_Report_${auditData.id ? auditData.id.slice(0, 8) : 'demo'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        logging: false
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf()
      .from(element)
      .set(opt)
      .save()
      .then(() => {
        setPdfGenerating(false);
      })
      .catch(err => {
        console.error("PDF generation failed, falling back to print:", err);
        setPdfGenerating(false);
        window.print();
      });
  };

  const exportCSV = () => {
    if (!auditData) return;
    setCsvExporting(true);
    try {
      const headers = ['Violation ID', 'Employee', 'Department', 'Rule Violated', 'Severity', 'Resolution Status', 'Log Evidence', 'Explanation', 'Recommendation', 'Mitigation Notes'];
      
      const escapeCSVField = (field) => {
        if (field === null || field === undefined) return '';
        const stringVal = String(field);
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      };

      const csvRows = [
        headers.join(','),
        ...filteredViolations.map(v => [
          v.id,
          v.employee || 'Unknown',
          v.department || 'Unknown',
          v.rule_violated || '',
          v.severity || 'Unknown',
          v.status || 'OPEN',
          v.log_entry || '',
          v.explanation || '',
          v.recommendation || '',
          v.mitigation_notes || ''
        ].map(escapeCSVField).join(','))
      ];
      
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Compliance_Violations_${auditData.id ? auditData.id.slice(0, 8) : 'demo'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV export failed:", err);
    } finally {
      setCsvExporting(false);
    }
  };

  const handleSaveMitigation = async () => {
    if (!selectedViolation) return;
    setSavingMitigation(true);
    
    try {
      // If there's no real audit record ID (e.g. demo data), update state locally only
      if (!auditData.id) {
        const updatedViolations = auditData.violations.map(v => {
          if (v.id === selectedViolation.id) {
            return { ...v, status: mitigationStatus, mitigation_notes: mitigationNotes };
          }
          return v;
        });
        setAuditData({
          ...auditData,
          violations: updatedViolations
        });
        setSelectedViolation(null);
        return;
      }

      const response = await axios.patch(
        `${BACKEND_URL}/audits/${auditData.id}/violations/${selectedViolation.id}`,
        {
          status: mitigationStatus,
          mitigation_notes: mitigationNotes
        }
      );
      
      if (response.data.status === 'success') {
        const updatedViolations = auditData.violations.map(v => {
          if (v.id === selectedViolation.id) {
            return { ...v, status: mitigationStatus, mitigation_notes: mitigationNotes };
          }
          return v;
        });
        setAuditData({
          ...auditData,
          violations: updatedViolations
        });
        setSelectedViolation(null);
      }
    } catch (err) {
      console.error("Failed to update violation mitigation status:", err);
      alert(err.response?.data?.detail || "Failed to update violation on backend.");
    } finally {
      setSavingMitigation(false);
    }
  };

  const SIMULATED_HIGH_RISK = useMemo(() => ({
    metrics: {
      compliance_score: 18,
      risk_distribution: { Low: 2, Medium: 5, High: 14, Critical: 28 },
      compliance_trend: [71, 74, 76, 79, 81, 18],
      violations_by_department: { Finance: 15, HR: 8, IT: 22, Sales: 4, Ops: 12 }
    },
    violations: [
      {
        id: "sim-101",
        employee: "E-9910",
        department: "IT",
        rule_violated: "Policy 2.1 - Data Exfiltration Controls",
        log_entry: "Employee ID: E-9910, Action: Bulk Download Customer Database, Size: 4.8 GB, Exfiltration Warning Fired",
        severity: "Critical",
        explanation: "Employee E-9910 downloaded 4.8 GB of sensitive customer database. Unauthorised bulk exfiltration.",
        recommendation: "Immediately revoke database access and suspend account credentials.",
        status: "OPEN"
      },
      {
        id: "sim-102",
        employee: "E-8732",
        department: "Finance",
        rule_violated: "Policy 1.4 - Unauthenticated Financial Transactions",
        log_entry: "Session IP: 192.168.1.99, Action: Wire Transfer Approve ($250,000), Auth: MFA Bypassed",
        severity: "High",
        explanation: "A financial wire transfer approval of $250,000 was executed without passing mandatory Multi-Factor Authentication.",
        recommendation: "Flag session IP and enforce immediate mandatory token re-verification.",
        status: "OPEN"
      },
      {
        id: "sim-103",
        employee: "E-4421",
        department: "IT",
        rule_violated: "Policy 3.2 - Open Access Key in Version Control",
        log_entry: "GitHub Push: Repo 'ai-model-serving', File: 'config.json', Secret: 'sk_live_...4f2a'",
        severity: "High",
        explanation: "Production OpenAI API secret key sk_live_...4f2a leaked in a public GitHub repository commit.",
        recommendation: "Rotate the compromised secret immediately and scan repositories for further secrets.",
        status: "OPEN"
      },
      {
        id: "sim-104",
        employee: "E-1044",
        department: "HR",
        rule_violated: "Policy 4.1 - Unauthorised PII Access",
        log_entry: "Employee ID: E-1044, Query: SELECT * FROM candidates WHERE salary > 120000",
        severity: "Medium",
        explanation: "Unauthorised direct query on employee salary database without business justification.",
        recommendation: "Enforce role-based access control and restrict salary tables to HR directors.",
        status: "OPEN"
      }
    ]
  }), []);

  const activeAuditData = useMemo(() => {
    if (simulatedState === 'high-risk') {
      return SIMULATED_HIGH_RISK;
    }
    return auditData || MOCK_RESULTS;
  }, [simulatedState, auditData]);

  const violations = activeAuditData?.violations || [];
  const metrics = activeAuditData?.metrics;

  const SEVERITY_WEIGHT = {
    CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
    Critical: 4, High: 3, Medium: 2, Low: 1
  };
  
  const STATUS_WEIGHT = {
    OPEN: 4, IN_PROGRESS: 3, MITIGATED: 2, FALSE_POSITIVE: 1
  };

  const filteredViolations = violations.filter(item => {
    const itemSeverity = item.severity ? item.severity.toUpperCase() : 'UNKNOWN';
    const matchesSeverity = filterSeverity === 'ALL' || itemSeverity === filterSeverity;
    
    const itemDept = item.department ? item.department.toUpperCase() : 'UNKNOWN';
    const matchesDept = filterDepartment === 'ALL' || itemDept === filterDepartment.toUpperCase();
    
    const itemStatus = item.status ? item.status.toUpperCase() : 'OPEN';
    const matchesStatus = filterStatus === 'ALL' || itemStatus === filterStatus;
    
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (item.employee || '').toLowerCase().includes(q) ||
      (item.department || '').toLowerCase().includes(q) ||
      (item.rule_violated || '').toLowerCase().includes(q) ||
      (item.log_entry || '').toLowerCase().includes(q) ||
      (item.explanation || '').toLowerCase().includes(q) ||
      (item.recommendation || '').toLowerCase().includes(q);
      
    return matchesSeverity && matchesDept && matchesStatus && matchesSearch;
  });

  const sortedViolations = [...filteredViolations].sort((a, b) => {
    let valA, valB;
    if (sortByField === 'severity') {
      valA = SEVERITY_WEIGHT[a.severity] || 0;
      valB = SEVERITY_WEIGHT[b.severity] || 0;
    } else if (sortByField === 'status') {
      valA = STATUS_WEIGHT[a.status] || 4;
      valB = STATUS_WEIGHT[b.status] || 4;
    } else if (sortByField === 'employee') {
      valA = a.employee || '';
      valB = b.employee || '';
    } else if (sortByField === 'department') {
      valA = a.department || '';
      valB = b.department || '';
    } else {
      valA = a.id;
      valB = b.id;
    }
    
    if (typeof valA === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
  });

  const getSeverityCount = (severity) => {
    if (severity === 'ALL') return violations.length;
    return violations.filter(v => (v.severity || '').toUpperCase() === severity).length;
  };

  const pieData = metrics ? [
    { name: 'Low', value: metrics.risk_distribution?.Low || 0 },
    { name: 'Medium', value: metrics.risk_distribution?.Medium || 0 },
    { name: 'High', value: metrics.risk_distribution?.High || 0 },
    { name: 'Critical', value: metrics.risk_distribution?.Critical || 0 },
  ] : [];

  const barData = metrics ? Object.entries(metrics.violations_by_department || {}).map(([key, val]) => ({
    name: key,
    violations: val
  })) : [];

  const trendData = metrics ? (metrics.compliance_trend || []).map((val, idx) => ({
    week: `W${idx + 1}`,
    score: val
  })) : [];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      
      {/* Navigation Bar */}
      <nav className="bg-[#1e293b] border-b border-slate-700/50 no-print">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-indigo-500" /> 
            <div>
              <span className="text-xl font-bold text-white tracking-tight block">AI Auditor</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block -mt-1">HR Operations</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* HR auditor info badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-800 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>{user?.email || 'hr.auditor@company.com'}</span>
              <span className="text-[9px] bg-purple-500/15 text-purple-400 font-extrabold px-1.5 py-0.5 rounded border border-purple-500/25 uppercase">Auditor</span>
            </div>
            <div className="flex bg-[#0f172a] rounded-xl p-1 shadow-inner border border-slate-800">
              <button 
                onClick={() => { setActiveTab('new_audit'); setAuditData(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'new_audit' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlusCircle className="w-4 h-4" /> New Audit
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'history' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" /> History
              </button>
              <button 
                onClick={() => setActiveTab('compare')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'compare' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitCompare className="w-4 h-4 text-indigo-300" /> Compare
              </button>
            </div>

            {onLogout && (
              <button 
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        
        {/* VIEW: NEW AUDIT */}
        {activeTab === 'new_audit' && (
          <div className="max-w-7xl mx-auto p-6 md:p-12 w-full animate-in fade-in zoom-in-95 duration-300">
            <header className="mb-10 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Run New Compliance Audit</h1>
                <p className="text-slate-400 mt-2 text-lg">Upload your policy and logs for instant AI analysis.</p>
              </div>
              <button 
                onClick={loadDemoData}
                className="px-5 py-2.5 bg-slate-800/50 hover:bg-slate-800 text-indigo-300 rounded-xl text-sm font-semibold border border-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-500/10"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" /> Load Demo Preview Data
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <label className="block text-sm font-semibold mb-4 flex items-center gap-2 text-slate-300">
                  <FileText className="w-5 h-5 text-indigo-400" /> Company Policy Document (.pdf, .txt)
                </label>
                <div className="flex items-center gap-4">
                  <label className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2.5 rounded-xl cursor-pointer font-semibold transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                    Choose File
                    <input 
                      type="file" 
                      accept=".pdf,.txt" 
                      onChange={(e) => setPolicyFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <span className="text-sm text-slate-400 truncate flex-1">
                    {policyFile ? policyFile.name : 'No file chosen'}
                  </span>
                </div>
              </div>

              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <label className="block text-sm font-semibold mb-4 flex items-center gap-2 text-slate-300">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" /> System Logs File (.csv, .txt, .json)
                </label>
                <div className="flex items-center gap-4">
                  <label className="bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl cursor-pointer font-semibold transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                    Choose File
                    <input 
                      type="file" 
                      accept=".csv,.txt,.json" 
                      onChange={(e) => setLogFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <span className="text-sm text-slate-400 truncate flex-1">
                    {logFile ? logFile.name : 'No file chosen'}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleAudit} 
              disabled={loading}
              className="w-full py-4 bg-[#4f46e5] hover:bg-[#4338ca] rounded-2xl font-bold text-lg flex justify-center items-center gap-3 transition-all shadow-xl shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <><Loader2 className="animate-spin w-6 h-6" /> Running Compliance Engine...</>
              ) : (
                <><Upload className="w-6 h-6" /> Run Audit Scan</>
              )}
            </button>

            {error && (
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-sm flex items-center gap-3 shadow-lg">
                <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-500" /> 
                <span className="font-medium">{error}</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW: AUDIT COMPARISON */}
        {activeTab === 'compare' && (
          <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 animate-in fade-in zoom-in-95 duration-300">
            <AuditComparison />
          </div>
        )}

        {/* VIEW: HISTORY */}
        {activeTab === 'history' && (
          <div className="max-w-7xl mx-auto p-6 md:p-12 w-full animate-in fade-in zoom-in-95 duration-300">
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-8 flex items-center gap-3">
              <History className="w-8 h-8 text-indigo-500" /> Audit History
            </h1>
            
            {historyLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="bg-[#1e293b] border border-slate-700 rounded-3xl p-12 text-center text-slate-400">
                <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No past audits found</h3>
                <p>Run a new audit scan to see it appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {historyData.map((record, idx) => {
                  const score = record.metrics?.compliance_score || 0;
                  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
                  
                  return (
                    <div key={record.id || idx} className="bg-[#1e293b] rounded-2xl border border-slate-700 hover:border-indigo-500/50 p-6 shadow-xl transition-all flex flex-col justify-between group">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <Clock className="w-4 h-4" /> {new Date(record.timestamp).toLocaleDateString()}
                          </div>
                          <div className={`text-2xl font-extrabold ${scoreColor}`}>
                            {score}
                          </div>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                          <div>
                            <span className="text-xs text-slate-500 block mb-1">Policy File</span>
                            <div className="bg-[#0f172a] text-slate-300 px-3 py-2 rounded-lg text-sm border border-slate-800 truncate">
                              <FileText className="w-4 h-4 inline mr-2 text-indigo-400" />
                              {record.policy_filename || 'Unknown'}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block mb-1">Log File</span>
                            <div className="bg-[#0f172a] text-slate-300 px-3 py-2 rounded-lg text-sm border border-slate-800 truncate">
                              <FileSpreadsheet className="w-4 h-4 inline mr-2 text-emerald-400" />
                              {record.log_filename || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => viewHistoricalReport(record)}
                        className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-400 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors cursor-pointer border border-indigo-500/30"
                      >
                        View Report <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW: REPORT DASHBOARD */}
        {activeTab === 'report' && auditData && (
          <div className="bg-slate-50 text-slate-800 flex-1 w-full pt-8 pb-24 animate-in slide-in-from-bottom-8 duration-500" id="report-container">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
              
              <div className="flex justify-between items-end mb-8 no-print">
                <div>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="text-slate-500 hover:text-[#4f46e5] font-bold text-sm flex items-center gap-1 mb-4 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to History
                  </button>
                  <h4 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2">INTERFACE</h4>
                  <h2 className="text-4xl font-extrabold text-[#1e293b]">Compliance Dashboard</h2>
                </div>
                
                <button
                  onClick={exportPDF}
                  disabled={pdfGenerating}
                  className="no-print bg-[#059669] hover:bg-[#047857] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {pdfGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Generating PDF...</>
                  ) : (
                    <><Download className="w-5 h-5" /> Export PDF Report</>
                  )}
                </button>
              </div>

              {/* HACKATHON COMPLIANCE SIMULATOR BANNER */}
              <div className="mb-6 p-4 bg-[#090d16] rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg shadow-slate-950/20 no-print">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Compliance & Risk Simulator</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Toggle simulated threat profiles to test system alerts, color changes, and sparkline trends live.</p>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => setSimulatedState('actual')}
                    className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      simulatedState === 'actual' 
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Actual Report ({auditData?.metrics?.compliance_score || MOCK_RESULTS.metrics.compliance_score}% Compliance)
                  </button>
                  <button 
                    onClick={() => setSimulatedState('high-risk')}
                    className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      simulatedState === 'high-risk' 
                        ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/25"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Simulate Threat Level (High Risk)
                  </button>
                </div>
              </div>

              {/* MOCK EMAIL ALERTS NOTIFICATION PANEL */}
              {auditData?.alert && (
                <div className="mb-6 p-5 rounded-2xl bg-[#090d16]/95 border border-slate-800 text-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-slate-950/20 no-print">
                  <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-xl border flex items-center justify-center ${
                      auditData.alert.triggered 
                        ? "bg-red-500/10 border-red-500/30 text-red-400" 
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Security Alert Status</h4>
                        <span className="text-[9px] bg-slate-800 text-indigo-400 font-extrabold px-1.5 py-0.5 rounded border border-slate-700 uppercase">Mock Email Demo</span>
                      </div>
                      <p className="text-sm font-extrabold text-white mt-1">{auditData.alert.message}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Recipient: <span className="font-semibold text-slate-200">{auditData.alert.recipient}</span> • Critical/High Violations Found: <span className="font-semibold text-slate-200">{auditData.alert.violation_count}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-indigo-500/15 border border-indigo-500/25 px-3.5 py-2 rounded-xl self-stretch sm:self-auto flex items-center justify-center text-center animate-pulse">
                    Mock Queue Active
                  </div>
                </div>
              )}

              {/* AI Insight Summary Panel */}
              <div className="mb-6">
                <AISummaryBox violations={violations} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Brand-New Modern Risk Score Card */}
                <RiskScoreCard metrics={metrics} violations={violations} />

                {/* 2. Standalone Risk Distribution Pie Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                  <h3 className="text-sm font-bold text-slate-600 mb-2">Risk Distribution</h3>
                  <div className="h-44 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.name]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 text-xs font-bold text-slate-700 mt-2 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>Low</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>Med</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>High</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>Crit</div>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-600 mb-6 text-center">Violations by Department</h3>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 'dataMax + 5']} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Bar dataKey="violations" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={45} label={{ position: 'top', fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-600 mb-6 text-center">Compliance Trend (6 Weeks)</h3>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="week" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Line type="monotone" dataKey="score" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 5, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Operations Summary Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-600 mb-4">Operations & Compliance Actions</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <span className="text-xs font-semibold text-slate-500 block mb-1">Total Flags</span>
                        <span className="text-2xl font-bold text-slate-800">{violations.length}</span>
                      </div>
                      <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                        <span className="text-xs font-semibold text-red-600 block mb-1">Open Issues</span>
                        <span className="text-2xl font-bold text-red-700">
                          {violations.filter(v => !v.status || v.status === 'OPEN' || v.status === 'IN_PROGRESS').length}
                        </span>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                        <span className="text-xs font-semibold text-emerald-600 block mb-1">Mitigated Items</span>
                        <span className="text-2xl font-bold text-emerald-700">
                          {violations.filter(v => v.status === 'MITIGATED').length}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <span className="text-xs font-semibold text-slate-500 block mb-1">False Positives</span>
                        <span className="text-2xl font-bold text-slate-700">
                          {violations.filter(v => v.status === 'FALSE_POSITIVE').length}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 no-print">
                    <div className="flex gap-3">
                      <button
                        onClick={exportPDF}
                        disabled={pdfGenerating}
                        className="flex-1 bg-[#059669] hover:bg-[#047857] text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
                      >
                        {pdfGenerating ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                          <><Download className="w-4 h-4" /> Export PDF</>
                        )}
                      </button>
                      
                      <button
                        onClick={exportCSV}
                        disabled={csvExporting}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/10 cursor-pointer disabled:opacity-50"
                      >
                        {csvExporting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Preparing...</>
                        ) : (
                          <><FileSpreadsheet className="w-4 h-4" /> Export CSV</>
                        )}
                      </button>
                    </div>
                    
                    <button
                      onClick={() => { setActiveTab('new_audit'); setAuditData(null); }}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 text-indigo-400" /> Run New Scan
                    </button>
                  </div>
                </div>

                {/* 6. Compliance Framework Category Breakdown Card */}
                <ComplianceBreakdownCard violations={violations} />
              </div>

              {/* ENTERPRISE VIOLATIONS EXPLORER & REGISTRY */}
              <div className="mt-8 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200" id="violations-registry-section">
                <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#1e293b] flex items-center gap-2">
                      <AlertTriangle className="text-amber-500 w-6 h-6" /> Violations Explorer
                    </h2>
                    <p className="text-slate-500 text-sm mt-0.5 font-medium">Showing {sortedViolations.length} of {violations.length} logged flags.</p>
                  </div>
                  
                  {/* Filters Toolbar */}
                  <div className="flex flex-wrap items-center gap-3 no-print">
                    {/* Search */}
                    <div className="relative flex-grow sm:flex-grow-0">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input 
                        type="text" 
                        placeholder="Search employee, rules, log..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                    </div>
                    
                    {/* Department Dropdown */}
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    >
                      <option value="ALL">All Departments</option>
                      <option value="Finance">Finance</option>
                      <option value="HR">HR</option>
                      <option value="IT">IT</option>
                      <option value="Sales">Sales</option>
                      <option value="Ops">Ops</option>
                    </select>

                    {/* Status Dropdown */}
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="MITIGATED">Mitigated</option>
                      <option value="FALSE_POSITIVE">False Positive</option>
                    </select>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-2">
                      <select
                        value={sortByField}
                        onChange={(e) => setSortByField(e.target.value)}
                        className="bg-transparent border-0 text-sm py-2 pr-2 outline-none cursor-pointer focus:ring-0 font-semibold text-slate-700"
                      >
                        <option value="severity">Sort: Severity</option>
                        <option value="status">Sort: Status</option>
                        <option value="employee">Sort: Employee</option>
                        <option value="department">Sort: Department</option>
                      </select>
                      <button 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left Column: Severity Selector + Table */}
                  <div className="flex-1 min-w-0">
                    {/* Severity Badge Selector */}
                    <div className="flex flex-wrap gap-1.5 mb-6 no-print">
                      {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => {
                        const isActive = filterSeverity === level;
                        const count = getSeverityCount(level);
                        return (
                          <button
                            key={level} 
                            onClick={() => setFilterSeverity(level)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                              isActive 
                                ? 'bg-slate-900 text-white shadow-sm' 
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {level}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                              isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                            }`}>{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Table */}
                    {sortedViolations.length === 0 ? (
                      <div className="p-12 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 font-medium">
                        No policy violations matching current filters.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                        <table className="w-full text-left border-collapse text-sm text-slate-600">
                          <thead>
                            <tr className="bg-slate-900 text-white">
                              <th className="p-4 font-semibold rounded-tl-xl w-24">Employee</th>
                              <th className="p-4 font-semibold w-28">Department</th>
                              <th className="p-4 font-semibold">Rule Violated</th>
                              <th className="p-4 font-semibold w-24 text-center">Severity</th>
                              <th className="p-4 font-semibold w-32 text-center">Status</th>
                              <th className="p-4 font-semibold rounded-tr-xl w-24 text-center no-print">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sortedViolations.map((v, i) => {
                              const sev = (v.severity || 'LOW').toUpperCase();
                              const sevBadges = {
                                CRITICAL: 'bg-red-100 text-red-800 border-red-200',
                                HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
                                MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
                                LOW: 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              };

                              const stat = (v.status || 'OPEN').toUpperCase();
                              const statusBadges = {
                                OPEN: 'bg-red-50 text-red-600 border-red-200',
                                IN_PROGRESS: 'bg-amber-50 text-amber-600 border-amber-200',
                                MITIGATED: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                                FALSE_POSITIVE: 'bg-slate-100 text-slate-600 border-slate-200'
                              };

                              return (
                                <tr key={v.id || i} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="p-4 font-bold text-slate-800">{v.employee || 'Unknown'}</td>
                                  <td className="p-4 font-medium text-slate-600">{v.department || 'Unknown'}</td>
                                  <td className="p-4">
                                    <div className="font-semibold text-slate-800">{v.rule_violated}</div>
                                    <div className="text-slate-400 text-xs mt-0.5 line-clamp-1">{v.explanation}</div>
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                      sevBadges[sev] || 'bg-slate-100 text-slate-800 border-slate-200'
                                    }`}>
                                      {sev}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase ${
                                      statusBadges[stat] || 'bg-slate-100 text-slate-800 border-slate-200'
                                    }`}>
                                      {stat.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center no-print">
                                    <button
                                      onClick={() => {
                                        setSelectedViolation(v);
                                        setMitigationStatus(v.status || 'OPEN');
                                        setMitigationNotes(v.mitigation_notes || '');
                                      }}
                                      className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                    >
                                      Manage
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Frequent Policy Breaches Histogram */}
                  <div className="w-full lg:w-80 flex-shrink-0 no-print">
                    <FrequentPoliciesCard violations={violations} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* MITIGATION DETAILS MODAL / DRAWER */}
      {selectedViolation && (
        <DrillDownModal
          violation={selectedViolation}
          onClose={() => setSelectedViolation(null)}
          mitigationStatus={mitigationStatus}
          setMitigationStatus={setMitigationStatus}
          mitigationNotes={mitigationNotes}
          setMitigationNotes={setMitigationNotes}
          onSave={handleSaveMitigation}
          saving={savingMitigation}
        />
      )}
    </div>
  );
}