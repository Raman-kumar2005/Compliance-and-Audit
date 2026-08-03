import React, { useState, useEffect } from 'react';
import AuditComparison from './components/AuditComparison';
import { 
  Upload, AlertTriangle, ShieldAlert, FileText, Loader2, 
  Sparkles, Download, Search, 
  ArrowRight, FileSpreadsheet, History, PlusCircle, ArrowLeft, Clock, LogOut, GitCompare
} from 'lucide-react';
import axios from 'axios';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, LineChart, Line, ResponsiveContainer 
} from 'recharts';

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

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('new_audit'); // 'new_audit', 'history', 'compare', 'report'
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [policyFile, setPolicyFile] = useState(null);
  const [logFile, setLogFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [error, setError] = useState('');
  
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllViolations, setShowAllViolations] = useState(false);

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
    setShowAllViolations(false);

    const formData = new FormData();
    formData.append('policy_file', policyFile);
    formData.append('log_file', logFile);

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
    setShowAllViolations(false);
    setAuditData(MOCK_RESULTS);
    setActiveTab('report');
  };

  const viewHistoricalReport = (record) => {
    setShowAllViolations(false);
    setAuditData(record);
    setActiveTab('report');
  };

  const exportPDF = () => {
    window.print();
  };

  const violations = auditData?.violations || [];
  const metrics = auditData?.metrics;

  const filteredData = violations.filter(item => {
    const itemSeverity = item.severity ? item.severity.toUpperCase() : 'UNKNOWN';
    const matchesSeverity = filterSeverity === 'ALL' || itemSeverity === filterSeverity;
    const matchesSearch = 
      (item.rule_violated || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.log_entry || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.explanation || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

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
            <span className="text-xl font-bold text-white tracking-tight">AI Auditor</span>
          </div>
          
          <div className="flex items-center gap-4">
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
                  className="no-print bg-[#059669] hover:bg-[#047857] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Download className="w-5 h-5" /> Export PDF Report
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score & Pie */}
                <div className="flex flex-col sm:flex-row gap-6 justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="bg-[#1e293b] text-white p-6 rounded-xl w-full sm:w-1/2 h-[220px] flex flex-col justify-between shadow-lg">
                    <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">COMPLIANCE<br/>SCORE</h3>
                    <div className="text-6xl font-extrabold my-2">{metrics?.compliance_score || 0}</div>
                    <div className="text-sm font-semibold text-slate-300">
                      {metrics?.compliance_score >= 80 ? 'Low Risk - Org-wide' : 'High Risk - Org-wide'}
                    </div>
                  </div>
                  <div className="w-full sm:w-1/2 flex flex-col items-center h-[220px] justify-center">
                    <h3 className="text-sm font-bold text-slate-600 mb-2">Risk Distribution</h3>
                    <div className="h-40 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={0} outerRadius={70} dataKey="value" stroke="none">
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.name]} />)}
                          </Pie>
                          <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4 text-xs font-bold text-slate-500 mt-2">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>Low</div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>Medium</div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>Critical</div>
                    </div>
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

                {/* Recent Table */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-slate-600 mb-4">Recent Violations</h3>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm text-slate-600">
                      <thead>
                        <tr className="bg-[#1e293b] text-white">
                          <th className="p-3.5 font-semibold rounded-tl-lg">Employee</th>
                          <th className="p-3.5 font-semibold">Rule</th>
                          <th className="p-3.5 font-semibold rounded-tr-lg text-center">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {violations.slice(0, 3).map((v, i) => (
                          <tr key={v.id || i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="p-3.5 font-bold text-slate-800 border-r border-slate-100/50">{v.employee || 'Unknown'}</td>
                            <td className="p-3.5 border-r border-slate-100/50 text-xs font-medium">{v.rule_violated}</td>
                            <td className="p-3.5 text-center font-semibold">{v.severity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {violations.length > 3 && !showAllViolations && (
                    <div className="text-right mt-4 no-print">
                      <button 
                        onClick={() => setShowAllViolations(true)}
                        className="text-sm text-[#4f46e5] font-bold cursor-pointer hover:underline flex items-center justify-end gap-1 ml-auto"
                      >
                        View all {violations.length} violations <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {showAllViolations && (
                <div className="mt-16 pt-8 border-t border-slate-200">
                  <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-8">
                    <h2 className="text-3xl font-extrabold text-[#1e293b] flex items-center gap-3">
                      <AlertTriangle className="text-amber-500 w-8 h-8" /> All Violations Detail
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-3 no-print">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                        <input type="text" placeholder="Search logs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
                          <button
                            key={level} onClick={() => setFilterSeverity(level)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterSeverity === level ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'}`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {filteredData.length === 0 ? (
                    <div className="p-12 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500">No violations match criteria.</div>
                  ) : (
                    <div className="space-y-6">
                      {filteredData.map((item, index) => {
                        const sev = item.severity ? item.severity.toUpperCase() : 'UNKNOWN';
                        const sevColors = { CRITICAL: 'bg-red-100 text-red-800', HIGH: 'bg-orange-100 text-orange-800', MEDIUM: 'bg-amber-100 text-amber-800', LOW: 'bg-emerald-100 text-emerald-800' };
                        return (
                          <div key={item.id || index} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8">
                            <div className="space-y-4 flex-1">
                              <div className="flex gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${sevColors[sev] || 'bg-slate-100 text-slate-800'}`}>{sev} SEVERITY</span>
                                <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Dept: {item.department || 'Unknown'} | Emp: {item.employee || 'Unknown'}</span>
                              </div>
                              <h3 className="font-extrabold text-xl text-[#1e293b]">{item.rule_violated}</h3>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm text-slate-700">
                                <strong className="font-sans block mb-1">Log Evidence:</strong> {item.log_entry}
                              </div>
                              <p className="text-sm text-slate-600"><strong className="text-slate-800">Analysis:</strong> {item.explanation}</p>
                            </div>
                            <div className="md:w-80 bg-slate-50/50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-center">
                              <span className="text-xs text-indigo-600 font-extrabold uppercase mb-3"><Sparkles className="w-4 h-4 inline mr-1" /> Recommended Action</span>
                              <p className="text-sm text-slate-700 font-medium">{item.recommendation}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}