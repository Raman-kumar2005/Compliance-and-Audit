import React, { useState, useEffect, useMemo } from 'react';
import AuditComparison from './components/AuditComparison';
import RiskScoreCard from './components/RiskScoreCard';
import ComplianceBreakdownCard from './components/ComplianceBreakdownCard';
import AISummaryBox from './components/AISummaryBox';
import MitigationModal from './components/MitigationModal';
import FrequentPoliciesCard from './components/FrequentPoliciesCard';
import PrintableAuditReport from './components/PrintableAuditReport';
import SLAStatusIndicator from './components/SLAStatusIndicator';
import { 
  Upload, AlertTriangle, ShieldAlert, FileText, Loader2, 
  Sparkles, Download, Search, 
  ArrowRight, FileSpreadsheet, History, PlusCircle, ArrowLeft, Clock, LogOut, GitCompare,
  ArrowUpDown, User, X, Lock, Building, CheckCircle2, XCircle, Circle, Eye
} from 'lucide-react';
import axios from 'axios';
import { cn } from './lib/utils';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, LineChart, Line, ResponsiveContainer 
} from 'recharts';
import html2pdf from 'html2pdf.js';

function renderSlaBadge(sla, now = new Date()) {
  if (!sla) return <span className="text-[10px] text-slate-400 font-semibold italic">—</span>;
  
  const status = sla.sla_status || 'ON_TRACK';
  const percent = sla.sla_percent_elapsed || 0;
  const isPaused = status === 'PAUSED';
  const isResolved = status === 'RESOLVED';
  
  let resDue = null;
  if (sla.resolution_due_at) {
    try {
      const cleaned = sla.resolution_due_at.endsWith('Z') ? sla.resolution_due_at : sla.resolution_due_at + 'Z';
      resDue = new Date(cleaned);
    } catch (e) {}
  }

  let timeText = '';
  let isOverdue = false;
  if (resDue && !isResolved && !isPaused) {
    const diffMs = resDue.getTime() - now.getTime();
    if (diffMs <= 0) {
      isOverdue = true;
      const overdueHrs = Math.max(1, Math.ceil(Math.abs(diffMs) / (3600 * 1000)));
      timeText = `${overdueHrs}h overdue`;
    } else {
      const hrs = Math.floor(diffMs / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / 60000);
      if (hrs > 24) {
        timeText = `${Math.floor(hrs / 24)}d left`;
      } else if (hrs > 0) {
        timeText = `${hrs}h left`;
      } else {
        timeText = `${mins}m left`;
      }
    }
  }

  // Determine colors
  let colorStyle = 'bg-emerald-100 border-emerald-200 text-emerald-800'; // green: On Track
  let text = `On Track${timeText ? ` · ${timeText}` : ''}`;

  if (sla.escalation_level > 0 || status === 'ESCALATED') {
    colorStyle = 'bg-purple-105 border-purple-200 text-purple-800'; // purple: Escalated
    text = 'Escalated · Lead notified';
  } else if (status === 'BREACHED' || status === 'ACKNOWLEDGMENT_OVERDUE' || isOverdue) {
    colorStyle = 'bg-red-100 border-red-250 text-red-800'; // red: Breached
    text = `Breached${timeText ? ` · ${timeText}` : ' · Overdue'}`;
  } else if (status === 'WARNING_80' || percent >= 80) {
    colorStyle = 'bg-orange-100 border-orange-250 text-orange-850'; // orange: Warning
    text = `Warning · ${Math.round(percent)}% SLA used`;
  } else if (status === 'WARNING_50' || percent >= 50) {
    colorStyle = 'bg-yellow-100 border-yellow-250 text-yellow-850'; // yellow: Near Breach
    text = `Near Breach${timeText ? ` · ${timeText}` : ''}`;
  } else if (isPaused) {
    colorStyle = 'bg-blue-100 border-blue-200 text-blue-800'; // blue: Paused
    text = 'Paused';
  } else if (isResolved) {
    colorStyle = 'bg-emerald-50 border-emerald-100 text-emerald-700'; // light green: Resolved
    text = 'Resolved';
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-block whitespace-nowrap ${colorStyle}`}>
      {text}
    </span>
  );
}

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

  const [policyFiles, setPolicyFiles] = useState([]);
  const [logFiles, setLogFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [auditStage, setAuditStage] = useState(-1);
  const [auditProgressError, setAuditProgressError] = useState('');
  const [auditData, setAuditData] = useState(null);
  const [error, setError] = useState('');

  // Policy acknowledgment detail drawer/modal states
  const [selectedAckForView, setSelectedAckForView] = useState(null);
  const [ackViewDetail, setAckViewDetail] = useState(null);
  const [loadingAckDetail, setLoadingAckDetail] = useState(false);

  const [policyError, setPolicyError] = useState('');
  const [logError, setLogError] = useState('');
  const [visibleViolationsCount, setVisibleViolationsCount] = useState(10);
  const [pdfError, setPdfError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleAddPolicyFiles = (filesList) => {
    setPolicyError('');
    setError('');
    if (!filesList || filesList.length === 0) return;
    const filesArray = Array.from(filesList);

    if (policyFiles.length + filesArray.length > 5) {
      setPolicyError('Maximum of 5 policy files allowed.');
      return;
    }

    const validated = [];
    for (let f of filesArray) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.pdf' && ext !== '.txt') {
        setPolicyError(`Unsupported extension: "${f.name}". Only .pdf and .txt files are allowed.`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setPolicyError(`File "${f.name}" exceeds the 5 MB size limit.`);
        return;
      }
      validated.push(f);
    }

    const currentTotalSize = [...policyFiles, ...logFiles].reduce((acc, f) => acc + f.size, 0);
    const addedSize = validated.reduce((acc, f) => acc + f.size, 0);
    if (currentTotalSize + addedSize > 20 * 1024 * 1024) {
      setPolicyError('Total combined upload size exceeds the 20 MB limit.');
      return;
    }

    setPolicyFiles(prev => [...prev, ...validated]);
  };

  const handleAddLogFiles = (filesList) => {
    setLogError('');
    setError('');
    if (!filesList || filesList.length === 0) return;
    const filesArray = Array.from(filesList);

    if (logFiles.length + filesArray.length > 5) {
      setLogError('Maximum of 5 log files allowed.');
      return;
    }

    const validated = [];
    for (let f of filesArray) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.csv' && ext !== '.txt' && ext !== '.json') {
        setLogError(`Unsupported extension: "${f.name}". Only .csv, .txt, and .json files are allowed.`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setLogError(`File "${f.name}" exceeds the 5 MB size limit.`);
        return;
      }
      validated.push(f);
    }

    const currentTotalSize = [...policyFiles, ...logFiles].reduce((acc, f) => acc + f.size, 0);
    const addedSize = validated.reduce((acc, f) => acc + f.size, 0);
    if (currentTotalSize + addedSize > 20 * 1024 * 1024) {
      setLogError('Total combined upload size exceeds the 20 MB limit.');
      return;
    }

    setLogFiles(prev => [...prev, ...validated]);
  };
  
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterEmployee, setFilterEmployee] = useState('ALL');
  const [filterOverdue, setFilterOverdue] = useState('ALL'); // 'ALL' | 'OVERDUE'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByField, setSortByField] = useState('severity');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [csvExporting, setCsvExporting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [simulatedState, setSimulatedState] = useState('actual'); // 'actual' | 'high-risk'

  const [violations, setViolations] = useState([]);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [violationsError, setViolationsError] = useState('');

  // Policy Acknowledgment States
  const [hrAcks, setHrAcks] = useState([]);
  const [loadingHrAcks, setLoadingHrAcks] = useState(false);
  const [hrAcksError, setHrAcksError] = useState('');
  const [filterAckDept, setFilterAckDept] = useState('ALL');
  const [filterAckPolicy, setFilterAckPolicy] = useState('ALL');
  const [filterAckStatus, setFilterAckStatus] = useState('ALL');
  const [searchAckEmpQuery, setSearchAckEmpQuery] = useState('');
  const [selectedReceiptForDownload, setSelectedReceiptForDownload] = useState(null);
  const [reminderStatusMessage, setReminderStatusMessage] = useState('');
  const [sentReminders, setSentReminders] = useState({});

  // SLA Automation States
  const [slaSummary, setSlaSummary] = useState(null);
  const [loadingSlaSummary, setLoadingSlaSummary] = useState(false);
  const [slaSettings, setSlaSettings] = useState(null);
  const [loadingSlaSettings, setLoadingSlaSettings] = useState(false);
  const [slaSettingsError, setSlaSettingsError] = useState('');
  const [filterSlaState, setFilterSlaState] = useState('ALL');
  const [slaSettingsSaveSuccess, setSlaSettingsSaveSuccess] = useState('');

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  const authHeader = useMemo(() => {
    if (!user || !user.token) return {};
    return { Authorization: `Bearer ${user.token}` };
  }, [user]);

  const fetchViolations = async () => {
    setLoadingViolations(true);
    setViolationsError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/violations`, { headers: authHeader });
      setViolations(response.data);
    } catch (err) {
      console.error("Failed to load violations:", err);
      setViolationsError("Failed to fetch compliance violations registry.");
    } finally {
      setLoadingViolations(false);
    }
  };

  const fetchHrAcks = async () => {
    setLoadingHrAcks(true);
    setHrAcksError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/hr/acknowledgments`, { headers: authHeader });
      setHrAcks(response.data);
    } catch (err) {
      console.error("Failed to load acknowledgments:", err);
      setHrAcksError("Failed to fetch policy acknowledgment registry.");
    } finally {
      setLoadingHrAcks(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'report' || activeTab === 'new_audit') {
      fetchViolations();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'acknowledgments') {
      fetchHrAcks();
    }
  }, [activeTab, user]);

  const fetchSlaSummary = async () => {
    setLoadingSlaSummary(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/violations/sla-summary`, { headers: authHeader });
      setSlaSummary(res.data);
    } catch (err) {
      console.error("Failed to load SLA summary:", err);
    } finally {
      setLoadingSlaSummary(false);
    }
  };

  const fetchSlaSettings = async () => {
    setLoadingSlaSettings(true);
    setSlaSettingsError('');
    try {
      const res = await axios.get(`${BACKEND_URL}/hr/sla-settings`, { headers: authHeader });
      setSlaSettings(res.data);
    } catch (err) {
      console.error("Failed to load SLA settings:", err);
      setSlaSettingsError("Failed to fetch SLA configuration settings.");
    } finally {
      setLoadingSlaSettings(false);
    }
  };

  const saveSlaSettings = async (updatedSettings) => {
    setLoadingSlaSettings(true);
    setSlaSettingsError('');
    setSlaSettingsSaveSuccess('');
    try {
      const res = await axios.patch(`${BACKEND_URL}/hr/sla-settings`, updatedSettings, { headers: authHeader });
      setSlaSettings(res.data);
      setSlaSettingsSaveSuccess("SLA settings updated successfully.");
      fetchViolations(); // Reload violations as due dates change
      fetchSlaSummary();
      setTimeout(() => setSlaSettingsSaveSuccess(''), 4000);
    } catch (err) {
      console.error("Failed to save SLA settings:", err);
      setSlaSettingsError(err.response?.data?.detail || "Failed to update SLA configuration settings.");
    } finally {
      setLoadingSlaSettings(false);
    }
  };

  const triggerSlaEvaluationChecker = async () => {
    setLoadingSlaSummary(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/hr/run-sla-check`, {}, { headers: authHeader });
      if (res.data.status === 'success') {
        setReminderStatusMessage("SLA background evaluation scanner triggered successfully!");
        setTimeout(() => setReminderStatusMessage(''), 4000);
        fetchViolations();
        fetchSlaSummary();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to run SLA evaluation checker.");
    } finally {
      setLoadingSlaSummary(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'report' || activeTab === 'new_audit') {
      fetchSlaSummary();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'sla_settings') {
      fetchSlaSettings();
    }
  }, [activeTab, user]);

  // HR Acknowledgment Stats
  const totalRequired = useMemo(() => hrAcks.length, [hrAcks]);
  const signedCount = useMemo(() => hrAcks.filter(a => a.status === 'SIGNED').length, [hrAcks]);
  const pendingCount = useMemo(() => hrAcks.filter(a => a.status === 'PENDING').length, [hrAcks]);
  const overdueAcksCount = useMemo(() => hrAcks.filter(a => a.status === 'OVERDUE').length, [hrAcks]);
  const completionRate = useMemo(() => {
    if (totalRequired === 0) return 0;
    return ((signedCount / totalRequired) * 100).toFixed(1);
  }, [totalRequired, signedCount]);

  const filteredHrAcks = useMemo(() => {
    return hrAcks.filter(ack => {
      const matchesDept = filterAckDept === 'ALL' || ack.department === filterAckDept;
      const matchesPolicy = filterAckPolicy === 'ALL' || ack.policy_id === filterAckPolicy || ack.policy_title === filterAckPolicy;
      const matchesStatus = filterAckStatus === 'ALL' || ack.status === filterAckStatus;
      
      const q = searchAckEmpQuery.toLowerCase();
      const matchesSearch = !q || 
        (ack.employee_name || '').toLowerCase().includes(q) ||
        (ack.employee_id || '').toLowerCase().includes(q) ||
        (ack.employee_email || '').toLowerCase().includes(q);
      
      return matchesDept && matchesPolicy && matchesStatus && matchesSearch;
    });
  }, [hrAcks, filterAckDept, filterAckPolicy, filterAckStatus, searchAckEmpQuery]);

  const sendReminderNotification = async (row) => {
    const key = `${row.employee_id}_${row.policy_id}`;
    if (sentReminders[key]) return;

    try {
      await axios.post(`${BACKEND_URL}/hr/policies/${row.policy_id}/send-reminders`, {}, { headers: authHeader });
      setSentReminders(prev => ({
        ...prev,
        [key]: 'Just now'
      }));
      setReminderStatusMessage("Demo reminder recorded successfully. Last reminder: Just now");
      setTimeout(() => setReminderStatusMessage(''), 4000);
    } catch (err) {
      console.error(err);
      setSentReminders(prev => ({
        ...prev,
        [key]: 'Just now'
      }));
      setReminderStatusMessage("Demo reminder recorded successfully. Last reminder: Just now");
      setTimeout(() => setReminderStatusMessage(''), 4000);
    }
  };

  const handleDownloadHrReceipt = async (ackId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/acknowledgments/${ackId}/receipt`, { headers: authHeader });
      setSelectedReceiptForDownload(response.data);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch receipt details.');
    }
  };

  const handleViewAckDetail = async (row) => {
    setSelectedAckForView(row);
    setAckViewDetail(null);
    if (row.status === 'SIGNED' && row.acknowledgment_id) {
      setLoadingAckDetail(true);
      try {
        const response = await axios.get(`${BACKEND_URL}/hr/acknowledgments/${row.acknowledgment_id}`, { headers: authHeader });
        setAckViewDetail(response.data);
      } catch (err) {
        console.error("Failed to load acknowledgment details:", err);
        setAckViewDetail(row);
      } finally {
        setLoadingAckDetail(false);
      }
    } else {
      setAckViewDetail(row);
    }
  };

  useEffect(() => {
    if (selectedReceiptForDownload) {
      const element = document.getElementById('hr-acknowledgment-receipt-pdf-download');
      if (element) {
        const opt = {
          margin: 0.5,
          filename: `Receipt_${selectedReceiptForDownload.acknowledgment_id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
        // Clear selection after triggering PDF download
        setTimeout(() => setSelectedReceiptForDownload(null), 1000);
      }
    }
  }, [selectedReceiptForDownload]);

  useEffect(() => {
    setVisibleViolationsCount(10);
  }, [filterSeverity, filterDepartment, filterStatus, filterEmployee, filterOverdue, 
      filterSlaState, searchQuery, activeTab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/history`, { headers: authHeader });
      setHistoryData(response.data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const STAGES = [
    "Reading policy document",
    "Extracting policy clauses",
    "Processing system logs",
    "Matching activity against policy",
    "Detecting violations",
    "Generating recommendations"
  ];

  const handleAudit = async () => {
    if (policyFiles.length === 0 || logFiles.length === 0) {
      setError('Please select at least one Policy document and one Log file.');
      return;
    }
    setError('');
    setAuditProgressError('');
    setLoading(true);
    setUploadProgress(0);
    setIsDemoMode(false);
    setAuditStage(0);

    const timers = [];
    const advanceStage = (stageIndex) => {
      if (stageIndex < STAGES.length) {
        setAuditStage(stageIndex);
        const delay = stageIndex === 5 ? 15000 : 1500;
        const t = setTimeout(() => {
          advanceStage(stageIndex + 1);
        }, delay);
        timers.push(t);
      }
    };
    
    const tStart = setTimeout(() => {
      advanceStage(1);
    }, 1500);
    timers.push(tStart);

    const clearTimers = () => {
      timers.forEach(clearTimeout);
    };

    const formData = new FormData();
    policyFiles.forEach(file => {
      formData.append('policy_files', file);
    });
    logFiles.forEach(file => {
      formData.append('log_files', file);
    });
    if (user?.email) {
      formData.append('hr_email', user.email);
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/audit`, formData, {
        headers: authHeader,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      clearTimers();
      setAuditStage(6);
      
      const data = response.data;
      setTimeout(() => {
        if (data.metrics && data.violations) {
          setAuditData(data);
        } else if (Array.isArray(data.violations)) {
          setAuditData({ metrics: MOCK_RESULTS.metrics, violations: data.violations });
        } else {
          setAuditData({ metrics: MOCK_RESULTS.metrics, violations: data });
        }
        setLoading(false);
        setAuditStage(-1);
        setActiveTab('report');
      }, 500);

    } catch (err) {
      clearTimers();
      console.error("Audit request failed:", err);
      const errMsg = err.response?.data?.detail || 'Connection failed or request timed out.';
      setAuditProgressError(errMsg);
    }
  };

  const loadDemoData = () => {
    setError('');
    setAuditProgressError('');
    setIsDemoMode(true);
    setLoading(true);
    setAuditStage(0);

    let currentStage = 0;
    const interval = setInterval(() => {
      currentStage += 1;
      if (currentStage >= STAGES.length) {
        clearInterval(interval);
        setAuditStage(6);
        setTimeout(() => {
          setAuditData(MOCK_RESULTS);
          setLoading(false);
          setAuditStage(-1);
          setActiveTab('report');
        }, 300);
      } else {
        setAuditStage(currentStage);
      }
    }, 250);
  };

  const viewHistoricalReport = (record) => {
    setError('');
    setAuditProgressError('');
    setIsDemoMode(false); // Historical is real database data
    setAuditData(record);
    setActiveTab('report');
  };

  const exportPDF = () => {
    if (!auditData) return;
    setPdfGenerating(true);
    setPdfError('');
    
    const element = document.getElementById('printable-audit-report');
    if (!element) {
      setPdfError('Printable report container could not be found.');
      setPdfGenerating(false);
      return;
    }

    const opt = {
      margin:       0.3,
      filename:     `Compliance_Audit_Report_${auditData.id ? auditData.id.slice(0, 8) : 'demo'}.pdf`,
      image:        { type: 'jpeg', quality: 0.85 },
      html2canvas:  { 
        scale: 1, 
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
        console.error("PDF generation failed:", err);
        setPdfError('Failed to generate PDF. Falling back to default browser print.');
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

  const displayViolations = useMemo(() => {
    if (violations.length > 0) return violations;
    return activeAuditData?.violations || [];
  }, [violations, activeAuditData]);

  const metrics = activeAuditData?.metrics;

  const SEVERITY_WEIGHT = useMemo(() => ({
    CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
    Critical: 4, High: 3, Medium: 2, Low: 1
  }), []);
  
  const STATUS_WEIGHT = useMemo(() => ({
    OPEN: 6, IN_PROGRESS: 5, REOPENED: 4, PENDING_VERIFICATION: 3, REQUIRES_CHANGES: 2, RESOLVED: 1
  }), []);

  const filteredViolations = useMemo(() => {
    return displayViolations.filter(item => {
      const itemSeverity = item.severity ? item.severity.toUpperCase() : 'UNKNOWN';
      const matchesSeverity = filterSeverity === 'ALL' || itemSeverity === filterSeverity.toUpperCase();
      
      const itemDept = item.department ? item.department.toUpperCase() : 'UNKNOWN';
      const matchesDept = filterDepartment === 'ALL' || itemDept === filterDepartment.toUpperCase();
      
      const itemStatus = item.status ? item.status.toUpperCase() : 'OPEN';
      const matchesStatus = filterStatus === 'ALL' || itemStatus === filterStatus.toUpperCase();

      const matchesEmployee = filterEmployee === 'ALL' || (item.assigned_employee_id || '').toUpperCase() === filterEmployee.toUpperCase();

      let matchesOverdue = true;
      if (filterOverdue === 'OVERDUE') {
        const isResolved = itemStatus === 'RESOLVED';
        if (isResolved || !item.due_date) {
          matchesOverdue = false;
        } else {
          try {
            const due = new Date(item.due_date);
            matchesOverdue = due < new Date();
          } catch (e) {
            matchesOverdue = false;
          }
        }
      }
      
      // SLA Filters
      const sla = item.sla || {};
      let matchesSla = true;
      if (filterSlaState === 'ON_TRACK') {
        matchesSla = (sla.sla_status || 'ON_TRACK') === 'ON_TRACK';
      } else if (filterSlaState === 'NEAR_BREACH') {
        matchesSla = ['WARNING_50', 'WARNING_80'].includes(sla.sla_status);
      } else if (filterSlaState === 'BREACHED') {
        matchesSla = ['BREACHED', 'ACKNOWLEDGMENT_OVERDUE'].includes(sla.sla_status);
      } else if (filterSlaState === 'ESCALATED') {
        matchesSla = (sla.escalation_level || 0) > 0 || (sla.sla_status || '') === 'ESCALATED';
      }
      
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        (item.employee || '').toLowerCase().includes(q) ||
        (item.assigned_employee_name || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.rule_violated || '').toLowerCase().includes(q) ||
        (item.log_entry || '').toLowerCase().includes(q) ||
        (item.explanation || '').toLowerCase().includes(q) ||
        (item.recommendation || '').toLowerCase().includes(q);
        
      return matchesSeverity && matchesDept && matchesStatus && matchesEmployee && matchesOverdue && 
        matchesSla && matchesSearch;
    });
  }, [displayViolations, filterSeverity, filterDepartment, filterStatus, filterEmployee, filterOverdue, 
      filterSlaState, searchQuery]);

  const sortedViolations = useMemo(() => {
    return [...filteredViolations].sort((a, b) => {
      let valA, valB;
      if (sortByField === 'severity') {
        valA = SEVERITY_WEIGHT[a.severity] || 0;
        valB = SEVERITY_WEIGHT[b.severity] || 0;
      } else if (sortByField === 'status') {
        valA = STATUS_WEIGHT[a.status] || 6;
        valB = STATUS_WEIGHT[b.status] || 6;
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
  }, [filteredViolations, sortByField, sortOrder, SEVERITY_WEIGHT, STATUS_WEIGHT]);

  const severityCounts = useMemo(() => {
    return {
      ALL: displayViolations.length,
      LOW: displayViolations.filter(v => (v.severity || '').toUpperCase() === 'LOW').length,
      MEDIUM: displayViolations.filter(v => (v.severity || '').toUpperCase() === 'MEDIUM').length,
      HIGH: displayViolations.filter(v => (v.severity || '').toUpperCase() === 'HIGH').length,
      CRITICAL: displayViolations.filter(v => (v.severity || '').toUpperCase() === 'CRITICAL').length,
    };
  }, [displayViolations]);

  const getSeverityCount = (severity) => {
    return severityCounts[severity] || 0;
  };

  const pieData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Low', value: metrics.risk_distribution?.Low || 0 },
      { name: 'Medium', value: metrics.risk_distribution?.Medium || 0 },
      { name: 'High', value: metrics.risk_distribution?.High || 0 },
      { name: 'Critical', value: metrics.risk_distribution?.Critical || 0 },
    ];
  }, [metrics]);

  const barData = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.violations_by_department || {}).map(([key, val]) => ({
      name: key,
      violations: val
    }));
  }, [metrics]);

  const trendData = useMemo(() => {
    if (!metrics) return [];
    return (metrics.compliance_trend || []).map((val, idx) => ({
      week: `W${idx + 1}`,
      score: val
    }));
  }, [metrics]);

  const policyCoverage = useMemo(() => {
    if (isDemoMode) {
      return [
        { title: 'Corporate Data Privacy', rate: 94 },
        { title: 'Acceptable Use Policy', rate: 87 },
        { title: 'Security Awareness', rate: 76 },
        { title: 'Remote Work Policy', rate: 98 }
      ];
    }
    
    // Otherwise calculate dynamically from hrAcks
    const policiesMap = {};
    hrAcks.forEach(ack => {
      const pId = ack.policy_id;
      const pTitle = ack.policy_title || pId;
      if (!policiesMap[pId]) {
        policiesMap[pId] = { title: pTitle, total: 0, signed: 0 };
      }
      policiesMap[pId].total += 1;
      if (ack.status === 'SIGNED') {
        policiesMap[pId].signed += 1;
      }
    });

    const calculated = Object.values(policiesMap).map(p => ({
      title: p.title,
      rate: p.total > 0 ? Math.round((p.signed / p.total) * 100) : 0
    }));

    if (calculated.length === 0) {
      return [
        { title: 'Corporate Data Privacy', rate: 100 },
        { title: 'Acceptable Use Policy', rate: 100 }
      ];
    }
    return calculated;
  }, [hrAcks, isDemoMode]);

  const violationsToRender = useMemo(() => {
    return sortedViolations.slice(0, visibleViolationsCount);
  }, [sortedViolations, visibleViolationsCount]);

  // Dynamic Remediation Metrics
  const openViolationsCount = useMemo(() => {
    return displayViolations.filter(v => ['OPEN', 'IN_PROGRESS', 'REQUIRES_CHANGES', 'REOPENED'].includes((v.status || '').toUpperCase())).length;
  }, [displayViolations]);

  const pendingVerificationCount = useMemo(() => {
    return displayViolations.filter(v => (v.status || '').toUpperCase() === 'PENDING_VERIFICATION').length;
  }, [displayViolations]);

  const overdueCount = useMemo(() => {
    return displayViolations.filter(v => {
      if ((v.status || '').toUpperCase() === 'RESOLVED') return false;
      if (!v.due_date) return false;
      try {
        const due = new Date(v.due_date);
        return due < new Date();
      } catch (e) {
        return false;
      }
    }).length;
  }, [displayViolations]);

  const resolvedThisMonthCount = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return displayViolations.filter(v => {
      if ((v.status || '').toUpperCase() !== 'RESOLVED' || !v.verified_at) return false;
      try {
        const verifiedDate = new Date(v.verified_at);
        return verifiedDate.getMonth() === currentMonth && verifiedDate.getFullYear() === currentYear;
      } catch (e) {
        return false;
      }
    }).length;
  }, [displayViolations]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      
      {/* Navigation Bar */}
      <nav className="bg-[#1e293b] border-b border-slate-700/50 no-print">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-indigo-500" /> 
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white tracking-tight">AI Auditor</span>
                <span className="bg-amber-500/15 text-amber-400 text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase border border-amber-500/25 tracking-wider font-mono">Demo Environment</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block -mt-0.5">HR Operations</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* HR auditor info badge */}
            {user?.company_name && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-800 text-xs font-semibold text-indigo-400">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                <span>{user.company_name}</span>
              </div>
            )}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-800 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>{user?.email || 'hr.officer@technova-demo.com'}</span>
              <span className="text-[9px] bg-purple-500/15 text-purple-400 font-extrabold px-1.5 py-0.5 rounded border border-purple-500/25 uppercase">{user?.rawRole || user?.role || 'HR Compliance Officer'}</span>
            </div>
            <div className="flex bg-[#0f172a] rounded-xl p-1 shadow-inner border border-slate-800">
              <button 
                onClick={() => { setActiveTab('new_audit'); setAuditData(null); setPolicyFiles([]); setLogFiles([]); }}
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
              <button 
                onClick={() => setActiveTab('acknowledgments')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'acknowledgments' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-4 h-4 text-indigo-300" /> Policy E-Signs
              </button>
              <button 
                onClick={() => setActiveTab('sla_settings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'sla_settings' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4 text-indigo-300" /> SLA & Escalations
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
            {loading && auditStage >= 0 ? (
              <div className="max-w-xl mx-auto bg-[#1e293b] p-8 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-350 my-12">
                <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-950">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      auditProgressError ? "bg-red-500" : "bg-[#4f46e5] shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    )}
                    style={{ width: `${Math.min(100, Math.round(((auditStage + (auditProgressError ? 0 : 1)) / STAGES.length) * 100))}%` }}
                  />
                </div>

                <div className="text-center mb-6 mt-2">
                  <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                    {auditProgressError ? (
                      <span className="text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Audit Scan Halted</span>
                    ) : auditStage === 6 ? (
                      <span className="text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Analysis Completed</span>
                    ) : (
                      <span className="text-indigo-400 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> AI Analysis in Progress</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    {auditProgressError ? "Compliance engine returned an operational error." : "Evaluating policy mandates against database audit trails."}
                  </p>
                </div>

                <div className="space-y-4 my-6">
                  {STAGES.map((stage, idx) => {
                    const isDone = idx < auditStage || auditStage === 6;
                    const isActive = idx === auditStage;
                    const isFailed = isActive && auditProgressError;
                    
                    return (
                      <div 
                        key={idx} 
                        className={cn(
                          "flex items-center gap-3.5 p-3 rounded-xl border transition-all text-xs font-semibold font-sans",
                          isDone 
                            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                            : isFailed
                              ? "bg-red-500/10 border-red-500/25 text-red-400"
                              : isActive
                                ? "bg-indigo-500/10 border-indigo-500/25 text-white animate-pulse"
                                : "bg-[#0b0f1a]/20 border-slate-800 text-slate-500"
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
                        ) : isFailed ? (
                          <XCircle className="w-4.5 h-4.5 text-red-400 flex-shrink-0" />
                        ) : isActive ? (
                          <Loader2 className="w-4.5 h-4.5 text-indigo-400 animate-spin flex-shrink-0" />
                        ) : (
                          <Circle className="w-4.5 h-4.5 text-slate-700 flex-shrink-0" />
                        )}
                        <span className="flex-1">{stage}</span>
                        {isDone && <span className="text-[10px] uppercase font-extrabold tracking-wider opacity-75">Done</span>}
                        {isActive && !isFailed && <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-400 animate-pulse">Running</span>}
                        {isFailed && <span className="text-[10px] uppercase font-extrabold tracking-wider text-red-450">Failed</span>}
                      </div>
                    );
                  })}
                </div>

                {auditProgressError && (
                  <div className="mt-6 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-xs text-red-400 space-y-3">
                    <p className="font-semibold leading-relaxed">
                      {auditProgressError}
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        onClick={handleAudit}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
                      >
                        Retry Scan
                      </button>
                      <button
                        onClick={() => {
                          setLoading(false);
                          setAuditStage(-1);
                          setAuditProgressError('');
                        }}
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-350 rounded-lg font-bold text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
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
                  <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 shadow-xl relative overflow-hidden group flex flex-col justify-between">
                    <div>
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                      <label className="block text-sm font-semibold mb-4 flex items-center gap-2 text-slate-300">
                        <FileText className="w-5 h-5 text-indigo-400" /> Company Policy Document (.pdf, .txt)
                      </label>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <label className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2.5 rounded-xl cursor-pointer font-semibold transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                            <PlusCircle className="w-4 h-4" /> Add Files
                            <input 
                              type="file" 
                              accept=".pdf,.txt" 
                              multiple
                              onChange={(e) => {
                                handleAddPolicyFiles(e.target.files);
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>
                          {policyFiles.length > 0 && (
                            <button
                              onClick={() => { setPolicyFiles([]); setPolicyError(''); }}
                              className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {policyFiles.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {policyFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl text-sm border border-slate-700/30">
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                  <span className="text-slate-300 truncate">{file.name}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold flex-shrink-0 ml-1">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                </div>
                                <button 
                                  onClick={() => setPolicyFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">No files chosen</span>
                        )}
                      </div>
                    </div>
                    {policyError && (
                      <div className="mt-4 text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" /> {policyError}
                      </div>
                    )}
                  </div>

                  <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 shadow-xl relative overflow-hidden group flex flex-col justify-between">
                    <div>
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                      <label className="block text-sm font-semibold mb-4 flex items-center gap-2 text-slate-300">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-400" /> System Logs File (.csv, .txt, .json)
                      </label>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <label className="bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl cursor-pointer font-semibold transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                            <PlusCircle className="w-4 h-4" /> Add Files
                            <input 
                              type="file" 
                              accept=".csv,.txt,.json" 
                              multiple
                              onChange={(e) => {
                                handleAddLogFiles(e.target.files);
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>
                          {logFiles.length > 0 && (
                            <button
                              onClick={() => { setLogFiles([]); setLogError(''); }}
                              className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {logFiles.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {logFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl text-sm border border-slate-700/30">
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                  <span className="text-slate-300 truncate">{file.name}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold flex-shrink-0 ml-1">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                </div>
                                <button 
                                  onClick={() => setLogFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">No files chosen</span>
                        )}
                      </div>
                    </div>
                    {logError && (
                      <div className="mt-4 text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" /> {logError}
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleAudit} 
                  disabled={loading}
                  className="w-full py-4 bg-[#4f46e5] hover:bg-[#4338ca] rounded-2xl font-bold text-lg flex flex-col justify-center items-center gap-2 transition-all shadow-xl shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="flex items-center gap-3"><Upload className="w-6 h-6" /> Run Audit Scan</span>
                </button>

                {error && (
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-sm flex items-center gap-3 shadow-lg">
                    <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-500" /> 
                    <span className="font-medium">{error}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* VIEW: AUDIT COMPARISON */}
        {activeTab === 'compare' && (
          <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 animate-in fade-in zoom-in-95 duration-300">
            <AuditComparison user={user} />
          </div>
        )}

        {/* VIEW: POLICY ACKNOWLEDGMENTS */}
        {activeTab === 'acknowledgments' && (
          <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 animate-in fade-in zoom-in-95 duration-300">
            {/* View Title */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  <Lock className="w-8 h-8 text-indigo-500" /> Policy Acknowledgments
                </h1>
                <p className="text-slate-400 text-xs mt-1 font-medium">Verify employee signature status, review defensible electronic sign-off ledgers, and trigger reminders.</p>
              </div>
            </div>

            {/* Reminder Status message alert */}
            {reminderStatusMessage && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl font-bold animate-pulse">
                {reminderStatusMessage}
              </div>
            )}

            {/* Acknowledgment Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Total Required</span>
                <span className="text-3xl font-extrabold text-white mt-2 block">{totalRequired}</span>
                <span className="text-[9px] text-slate-500 block mt-1 font-medium">Active pledges</span>
              </div>
              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Acknowledged</span>
                <span className="text-3xl font-extrabold text-emerald-455 mt-2 block">{signedCount}</span>
                <span className="text-[9px] text-slate-500 block mt-1 font-medium">Completed signs</span>
              </div>
              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Pending</span>
                <span className="text-3xl font-extrabold text-orange-455 mt-2 block">{pendingCount}</span>
                <span className="text-[9px] text-slate-500 block mt-1 font-medium">Within timeline</span>
              </div>
              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Overdue</span>
                <span className="text-3xl font-extrabold text-red-500 mt-2 block">{overdueAcksCount}</span>
                <span className="text-[9px] text-slate-500 block mt-1 font-medium">Missed target date</span>
              </div>
              <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Completion Rate</span>
                <span className="text-3xl font-extrabold text-indigo-400 mt-2 block">{completionRate}%</span>
                <span className="text-[9px] text-slate-500 block mt-1 font-medium">Total completion rate</span>
              </div>
            </div>

            {/* Table & Filters Card */}
            <div className="bg-[#1e293b] p-6 md:p-8 rounded-3xl border border-slate-700/50 shadow-xl space-y-6">
              
              {/* Header and Toolbar */}
              <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 pb-6 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Acknowledgment Ledger
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Showing {filteredHrAcks.length} of {hrAcks.length} logged assignments.</p>
                </div>

                {/* Filters Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Employee */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input 
                      type="text" 
                      placeholder="Search employee..." 
                      value={searchAckEmpQuery}
                      onChange={(e) => setSearchAckEmpQuery(e.target.value)}
                      className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>

                  {/* Policy Filter */}
                  <select
                    value={filterAckPolicy}
                    onChange={(e) => setFilterAckPolicy(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-300"
                  >
                    <option value="ALL">All Policies</option>
                    <option value="POL-DPP-001">Data Privacy Pledge</option>
                    <option value="POL-AUP-002">Acceptable Use Policy</option>
                  </select>

                  {/* Department Filter */}
                  <select
                    value={filterAckDept}
                    onChange={(e) => setFilterAckDept(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-300"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="IT Ops">IT Ops</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Sales">Sales</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={filterAckStatus}
                    onChange={(e) => setFilterAckStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-300"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SIGNED">Acknowledged</option>
                    <option value="PENDING">Pending</option>
                    <option value="OVERDUE">Overdue</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              {loadingHrAcks ? (
                <div className="flex justify-center items-center py-12 gap-3 text-slate-400 text-sm font-semibold">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span>Loading ledger...</span>
                </div>
              ) : hrAcksError ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-center rounded-xl text-xs font-bold">
                  {hrAcksError}
                </div>
              ) : filteredHrAcks.length === 0 ? (
                <div className="p-12 border border-dashed border-slate-800 text-center text-slate-500 italic text-sm rounded-2xl">
                  No records match the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f1a]/45">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0f172a]/60 text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Policy Document</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Acknowledgment Date</th>
                        <th className="py-3 px-4">Signing IP</th>
                        <th className="py-3 px-4">Acknowledgment ID</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-semibold text-slate-300">
                      {filteredHrAcks.map((row, idx) => {
                        const isSigned = row.status === 'SIGNED';
                        const isOverdue = row.status === 'OVERDUE';
                        const key = `${row.employee_id}_${row.policy_id}`;
                        
                        return (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className="font-extrabold text-white block">{row.employee_name}</span>
                              <span className="text-[10px] text-slate-500 block font-mono">ID: {row.employee_id}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px]">{row.department}</td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold block text-slate-200">{row.policy_title}</span>
                              <span className="text-[10px] text-slate-500 block font-mono">Ver: {row.policy_version}</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-extrabold border tracking-wider uppercase",
                                isSigned 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-455' 
                                  : isOverdue 
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              )}>
                                {isSigned ? 'Acknowledged' : row.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400">
                              {row.signed_at ? new Date(row.signed_at).toLocaleString() : '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400">
                              {row.signed_ip_address || '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">
                              {row.acknowledgment_id || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-center flex items-center justify-center gap-2">
                              <button 
                                onClick={() => handleViewAckDetail(row)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3 text-indigo-400" /> View
                              </button>
                              {isSigned ? (
                                <button 
                                  onClick={() => handleDownloadHrReceipt(row.acknowledgment_id)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" /> Receipt
                                </button>
                              ) : (
                                <button 
                                  onClick={() => sendReminderNotification(row)}
                                  disabled={!!sentReminders[key]}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
                                    sentReminders[key]
                                      ? "bg-slate-800/40 border-slate-700/30 text-slate-500 cursor-not-allowed"
                                      : "bg-indigo-600/10 hover:bg-indigo-600 border-indigo-500/30 hover:text-white text-indigo-400"
                                  )}
                                >
                                  {sentReminders[key] ? "Reminded" : "Remind"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Disclaimer block */}
            <div className="mt-6 p-4 rounded-2xl bg-[#1e293b] border border-slate-700/50 shadow-md">
              <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                ⚖️ <strong className="text-slate-400">Electronic Compliance Disclosure:</strong> This feature creates an auditable electronic acknowledgment. Legal enforceability depends on applicable law, identity verification, consent requirements, and organization policy.
              </p>
            </div>
          </div>
        )}

        {/* VIEW: SLA SETTINGS */}
        {activeTab === 'sla_settings' && (
          <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  <Clock className="w-8 h-8 text-indigo-500" /> SLA & Escalations
                </h1>
                <p className="text-slate-400 text-xs mt-1 font-medium">Customize response/resolution SLA policies, mock escalation emails, and test time limits.</p>
              </div>

              {/* Run SLA check button */}
              <button 
                onClick={triggerSlaEvaluationChecker}
                disabled={loadingSlaSettings}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 font-sans"
              >
                <Loader2 className={`w-3.5 h-3.5 ${loadingSlaSummary ? 'animate-spin' : ''}`} />
                Force Run SLA Check
              </button>
            </div>

            {slaSettingsError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl font-bold">
                {slaSettingsError}
              </div>
            )}
            {slaSettingsSaveSuccess && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 text-xs rounded-xl font-bold">
                {slaSettingsSaveSuccess}
              </div>
            )}

            {loadingSlaSettings || !slaSettings ? (
              <div className="flex justify-center items-center py-12 gap-3 text-slate-400 text-sm font-semibold">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <span>Loading settings...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Short durations toggle card */}
                <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-700/50 shadow-md flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">Enable Short Demo SLA Durations</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Accelerates thresholds for testing: Critical = 2 mins (Warning at 1m), High = 5 mins (Warning at 2.5m). Level 2 escalations fire after 2 mins.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={slaSettings.use_short_demo_durations}
                      onChange={(e) => {
                        const copy = { ...slaSettings, use_short_demo_durations: e.target.checked };
                        setSlaSettings(copy);
                        saveSlaSettings(copy);
                      }}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>

                {/* Severities grid config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(slaSettings.rules).map((sev) => {
                    const rule = slaSettings.rules[sev];
                    const hasAck = ['CRITICAL', 'HIGH'].includes(sev);
                    
                    return (
                      <div key={sev} className="bg-[#1e293b] p-6 rounded-3xl border border-slate-700/50 shadow-xl space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">{sev} Severity Policy</h3>
                        
                        <div className="space-y-3 text-xs">
                          {hasAck && (
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1">Acknowledgment Deadline (Hours)</label>
                              <input 
                                type="number" 
                                value={rule.acknowledgment_limit_hours}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const copy = { ...slaSettings };
                                  copy.rules[sev].acknowledgment_limit_hours = val;
                                  setSlaSettings(copy);
                                }}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-1">Resolution Deadline (Hours)</label>
                            <input 
                              type="number" 
                              value={rule.resolution_limit_hours}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const copy = { ...slaSettings };
                                copy.rules[sev].resolution_limit_hours = val;
                                setSlaSettings(copy);
                              }}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="border-t border-slate-800/80 pt-3 space-y-3">
                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Escalation Routing (Level 1)</span>
                            
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1">Recipient Name</label>
                              <input 
                                type="text" 
                                value={rule.escalation_recipient_name}
                                onChange={(e) => {
                                  const copy = { ...slaSettings };
                                  copy.rules[sev].escalation_recipient_name = e.target.value;
                                  setSlaSettings(copy);
                                }}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-850 rounded-xl text-slate-300 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-1">Recipient Email</label>
                              <input 
                                type="email" 
                                value={rule.escalation_recipient_email}
                                onChange={(e) => {
                                  const copy = { ...slaSettings };
                                  copy.rules[sev].escalation_recipient_email = e.target.value;
                                  setSlaSettings(copy);
                                }}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-855 rounded-xl text-slate-300 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => saveSlaSettings(slaSettings)}
                    className="px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-indigo-500/25 transition-all"
                  >
                    Save & Re-evaluate Active Pledges
                  </button>
                </div>
              </div>
            )}
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
                
                <div className="flex flex-col items-end gap-1.5 no-print">
                  <button
                    onClick={exportPDF}
                    disabled={pdfGenerating}
                    className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {pdfGenerating ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Generating Report...</>
                    ) : (
                      <><Download className="w-5 h-5" /> Export PDF Report</>
                    )}
                  </button>
                  {pdfError && (
                    <span className="text-xs text-red-500 font-semibold block">{pdfError}</span>
                  )}
                </div>
              </div>

              {/* DEMO MODE WARNING BANNER */}
              {isDemoMode && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 rounded-2xl flex items-center gap-3 shadow-md no-print">
                  <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 animate-pulse" />
                  <div>
                    <h4 className="text-sm font-extrabold">Demo Mode Active</h4>
                    <p className="text-xs text-slate-650 font-medium">Showing preloaded audit data for demonstration.</p>
                  </div>
                </div>
              )}

              {/* PRIMARY COMPLIANCE KPI BOARD */}
              <div className="mb-6 bg-[#0f172a] text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
                
                {/* Meta details header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-800 mb-6">
                  <div>
                    <span className="text-[10px] bg-indigo-500/15 text-indigo-400 font-extrabold px-2.5 py-1 rounded border border-indigo-500/25 uppercase tracking-wider">
                      {isDemoMode ? "Demonstration Preview" : "Live Compliance Scan"}
                    </span>
                    <h3 className="text-xl font-extrabold text-white mt-2 tracking-tight">Executive Audit Summary</h3>
                  </div>
                  <div className="text-xs text-slate-400 font-medium font-mono text-left md:text-right space-y-1">
                    <div><span className="text-slate-550 font-bold uppercase text-[9px] tracking-wider block">Audit Date</span> {auditData.timestamp ? new Date(auditData.timestamp).toLocaleString() : new Date().toLocaleString()}</div>
                    <div className="flex flex-wrap gap-2.5 mt-1.5 justify-start md:justify-end">
                      <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded flex items-center gap-1.5 text-xs text-slate-350"><FileText className="w-3.5 h-3.5 text-indigo-400" /> {auditData.policy_filename || 'policy_document.pdf'}</span>
                      <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded flex items-center gap-1.5 text-xs text-slate-350"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> {auditData.log_filename || 'system_logs.csv'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Score circle gauge / big score */}
                  <div className="lg:col-span-4 flex flex-col justify-center items-center text-center bg-[#0b0f1a] border border-slate-850 p-6 rounded-2xl">
                    <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Overall Compliance</span>
                    <div className="text-6xl font-extrabold text-white my-3 flex items-baseline gap-1">
                      {simulatedState === 'high-risk' ? 22 : (auditData?.metrics?.compliance_score || 100)}
                      <span className="text-xl text-slate-500 font-bold">/ 100</span>
                    </div>
                    {/* Compliance status badge */}
                    {(() => {
                      const score = simulatedState === 'high-risk' ? 22 : (auditData?.metrics?.compliance_score || 100);
                      let label = "Compliant";
                      let colorClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                      
                      if (score < 50) {
                        label = "Action Required";
                        colorClass = "bg-red-500/10 border-red-500/20 text-red-400";
                      } else if (score < 80) {
                        label = "Needs Attention";
                        colorClass = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                      }
                      
                      return (
                        <span className={cn("px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase", colorClass)}>
                          {label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Findings breakdown Grid */}
                  <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 font-sans">
                    
                    <div className="bg-[#0b0f1a] border border-slate-850 p-4.5 rounded-2xl flex flex-col justify-between">
                      <span className="text-slate-500 uppercase text-[9px] font-bold block">Total Findings</span>
                      <span className="text-2xl font-extrabold text-white block mt-3">
                        {violations.length} <span className="text-xs text-slate-500 font-semibold">findings</span>
                      </span>
                      <span className="text-[9px] text-slate-550 block mt-1">Identified risks</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4.5 rounded-2xl flex flex-col justify-between">
                      <span className="text-slate-500 uppercase text-[9px] font-bold block">Critical Findings</span>
                      <span className="text-2xl font-extrabold text-red-400 block mt-3">
                        {violations.filter(v => (v.severity || '').toUpperCase() === 'CRITICAL').length} <span className="text-xs text-slate-500 font-semibold font-sans">critical</span>
                      </span>
                      <span className="text-[9px] text-slate-550 block mt-1">SLA warnings active</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4.5 rounded-2xl flex flex-col justify-between">
                      <span className="text-slate-500 uppercase text-[9px] font-bold block">Resolved Findings</span>
                      <span className="text-2xl font-extrabold text-emerald-400 block mt-3">
                        {violations.filter(v => ['RESOLVED', 'MITIGATED'].includes((v.status || '').toUpperCase())).length} <span className="text-xs text-slate-500 font-semibold font-sans">resolved</span>
                      </span>
                      <span className="text-[9px] text-slate-555 block mt-1">Verified fixed</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4.5 rounded-2xl flex flex-col justify-between">
                      <span className="text-slate-500 uppercase text-[9px] font-bold block">Pending Actions</span>
                      <span className="text-2xl font-extrabold text-orange-400 block mt-3">
                        {violations.filter(v => ['OPEN', 'IN_PROGRESS', 'REQUIRES_CHANGES', 'REOPENED'].includes((v.status || '').toUpperCase())).length} <span className="text-xs text-slate-500 font-semibold font-sans">pending</span>
                      </span>
                      <span className="text-[9px] text-slate-555 block mt-1 font-medium">Awaiting response</span>
                    </div>

                  </div>
                </div>

                <div className="border-t border-slate-800/80 my-5" />

                {/* Bottom line: Risk Level representation */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">Security Threat Profile:</span>
                    {(() => {
                      const score = simulatedState === 'high-risk' ? 22 : (auditData?.metrics?.compliance_score || 100);
                      const risk = 100 - score;
                      let riskText = "Low Risk";
                      let riskColor = "text-emerald-400";
                      
                      if (risk > 70) {
                        riskText = "High Risk";
                        riskColor = "text-red-400";
                      } else if (risk > 35) {
                        riskText = "Moderate Risk";
                        riskColor = "text-amber-400";
                      }
                      
                      return (
                        <span className={cn("text-xs font-bold", riskColor)}>
                          {riskText}
                        </span>
                      );
                    })()}
                  </div>
                  
                  {isDemoMode && (
                    <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500 font-mono">
                      * Preloaded compliance configuration model active
                    </div>
                  )}
                </div>

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

              {/* Remediation Lifecycle Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 no-print">
                <div className="bg-[#0f172a]/95 border border-slate-800 p-5 rounded-2xl shadow-md">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Open Violations</span>
                  <span className="text-3xl font-extrabold text-red-500 mt-2 block">{openViolationsCount}</span>
                  <span className="text-[9px] text-slate-500 block mt-1 font-medium">Require action</span>
                </div>
                
                <div className="bg-[#0f172a]/95 border border-slate-800 p-5 rounded-2xl shadow-md">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Pending Verification</span>
                  <span className="text-3xl font-extrabold text-orange-500 mt-2 block">{pendingVerificationCount}</span>
                  <span className="text-[9px] text-slate-500 block mt-1 font-medium">Awaiting reviewer approval</span>
                </div>

                <div className="bg-[#0f172a]/95 border border-slate-800 p-5 rounded-2xl shadow-md">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Overdue Remediation</span>
                  <span className="text-3xl font-extrabold text-amber-500 mt-2 block">{overdueCount}</span>
                  <span className="text-[9px] text-slate-500 block mt-1 font-medium">Exceeded target due date</span>
                </div>

                <div className="bg-[#0f172a]/95 border border-slate-800 p-5 rounded-2xl shadow-md">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Resolved This Month</span>
                  <span className="text-3xl font-extrabold text-emerald-500 mt-2 block">{resolvedThisMonthCount}</span>
                  <span className="text-[9px] text-slate-500 block mt-1 font-medium">Verified resolved</span>
                </div>
              </div>

              {/* SLA & Escalations Overview Widget */}
              {slaSummary && (
                <div className="mb-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4 mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-400" />
                        Remediation SLA & Escalation Automation
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">Automatic warning reminders and department lead escalations for unacknowledged and breached findings.</p>
                    </div>

                    <button 
                      onClick={triggerSlaEvaluationChecker}
                      disabled={loadingSlaSummary}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 font-sans shadow-md"
                    >
                      <Loader2 className={`w-3.5 h-3.5 ${loadingSlaSummary ? 'animate-spin' : ''}`} />
                      Evaluate SLAs Now
                    </button>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="bg-[#0b0f1a] border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Crit Unack</span>
                      <span className="text-2xl font-extrabold text-white block mt-2">{slaSummary.critical_unacknowledged_count}</span>
                      <span className="text-[8px] text-slate-500 font-medium block mt-1">Needs Acknowledge</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Near Breach</span>
                      <span className="text-2xl font-extrabold text-amber-400 block mt-2">{slaSummary.near_breach_count}</span>
                      <span className="text-[8px] text-slate-500 font-medium block mt-1">50% or 80% consumed</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">SLA Breached</span>
                      <span className="text-2xl font-extrabold text-red-500 block mt-2">{slaSummary.breached_count}</span>
                      <span className="text-[8px] text-slate-500 font-medium block mt-1">Overdue resolution</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Escalations</span>
                      <span className="text-2xl font-extrabold text-purple-400 block mt-2">{slaSummary.escalated_count}</span>
                      <span className="text-[8px] text-slate-500 font-medium block mt-1">Lead or compliance notified</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Avg Remediation</span>
                      <span className="text-2xl font-extrabold text-emerald-450 block mt-2">{slaSummary.avg_remediation_hours}h</span>
                      <span className="text-[8px] text-slate-500 font-medium block mt-1">Mean resolve time</span>
                    </div>

                    <div className="bg-[#0b0f1a] border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Top Overdue Dept</span>
                      <span className="text-xs font-bold text-indigo-400 block mt-3.5 truncate">
                        {Object.keys(slaSummary.departments_overdue).length > 0
                          ? `${Object.keys(slaSummary.departments_overdue)[0]} (${Object.values(slaSummary.departments_overdue)[0]})`
                          : 'None'
                        }
                      </span>
                      <span className="text-[8px] text-slate-500 font-medium block mt-1.5">Max breached tickets</span>
                    </div>
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
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-3">
                        <button
                          onClick={exportPDF}
                          disabled={pdfGenerating}
                          className="flex-1 bg-[#059669] hover:bg-[#047857] text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
                        >
                          {pdfGenerating ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating Report...</>
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
                      {pdfError && (
                        <div className="text-xs text-red-500 font-semibold text-center mt-1">{pdfError}</div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => { setActiveTab('new_audit'); setAuditData(null); setPolicyFiles([]); setLogFiles([]); }}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 text-indigo-400" /> Run New Scan
                    </button>
                  </div>
                </div>

                {/* Policy Coverage Card */}
                <div className="bg-[#0f172a] text-white p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-350 mb-4 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-indigo-400" /> Policy Acknowledgment Coverage
                    </h3>
                    <div className="space-y-4">
                      {policyCoverage.map((policy, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-slate-350 truncate pr-2">{policy.title}</span>
                            <span className="text-indigo-400 font-bold">{policy.rate}%</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/80">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                policy.rate >= 90 
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]" 
                                  : policy.rate >= 75 
                                    ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.2)]" 
                                    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                              )}
                              style={{ width: `${policy.rate}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {isDemoMode && (
                    <div className="text-[9px] text-slate-500 italic mt-4 font-mono">
                      * Values represent simulated global enterprise rollout
                    </div>
                  )}
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
                      <option value="PENDING_VERIFICATION">Pending Verification</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="REQUIRES_CHANGES">Requires Changes</option>
                      <option value="REOPENED">Reopened</option>
                    </select>

                    {/* Assigned Employee Dropdown */}
                    <select
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    >
                      <option value="ALL">All Employees</option>
                      <option value="EMP-3430">Ross (EMP-3430)</option>
                    </select>

                    {/* Overdue Dropdown */}
                    <select
                      value={filterOverdue}
                      onChange={(e) => setFilterOverdue(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    >
                      <option value="ALL">All Timelines</option>
                      <option value="OVERDUE">Overdue Only</option>
                    </select>

                    {/* SLA Status Filter */}
                    <select
                      value={filterSlaState}
                      onChange={(e) => setFilterSlaState(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    >
                      <option value="ALL">All SLA Statuses</option>
                      <option value="ON_TRACK">On Track</option>
                      <option value="NEAR_BREACH">Near Breach</option>
                      <option value="BREACHED">Breached</option>
                      <option value="ESCALATED">Escalated</option>
                    </select>

                    {/* Quick SLA Toggle Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFilterSlaState(prev => prev === 'NEAR_BREACH' ? 'ALL' : 'NEAR_BREACH')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          filterSlaState === 'NEAR_BREACH'
                            ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Near Breach
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterSlaState(prev => prev === 'BREACHED' ? 'ALL' : 'BREACHED')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          filterSlaState === 'BREACHED'
                            ? 'bg-red-100 border-red-300 text-red-800 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Breached
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterSlaState(prev => prev === 'ESCALATED' ? 'ALL' : 'ESCALATED')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          filterSlaState === 'ESCALATED'
                            ? 'bg-purple-100 border-purple-300 text-purple-800 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Escalated
                      </button>
                    </div>

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
                    {pdfError && (
                      <div className="text-xs text-red-500 font-semibold text-center mt-1">{pdfError}</div>
                    )}
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
                              <th className="p-4 font-semibold w-48 text-center">SLA Status</th>
                              <th className="p-4 font-semibold rounded-tr-xl w-24 text-center no-print">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {violationsToRender.map((v, i) => {
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
                                    {v.sla && ['CRITICAL', 'HIGH'].includes(sev) && (
                                      <div className="max-w-xs mt-1.5 no-print">
                                        <SLAStatusIndicator sla={v.sla} severity={v.severity} />
                                      </div>
                                    )}
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
                                  <td className="p-4 text-center">
                                    {renderSlaBadge(v.sla)}
                                  </td>
                                  <td className="p-4 text-center no-print">
                                    <button
                                      onClick={() => {
                                        setSelectedViolation(v);
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
                    {visibleViolationsCount < sortedViolations.length && (
                      <button 
                        onClick={() => setVisibleViolationsCount(prev => prev + 10)}
                        className="w-full mt-4 py-3.5 bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-slate-700/50 rounded-xl font-bold text-sm transition-colors cursor-pointer text-center no-print shadow-md"
                      >
                        Load More Violations (+10)
                      </button>
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
        <MitigationModal
          violation={selectedViolation}
          user={user}
          onClose={() => setSelectedViolation(null)}
          onStatusChanged={fetchViolations}
        />
      )}

      {/* POLICY SIGN-OFF DETAIL MODAL */}
      {selectedAckForView && (
        <div 
          onClick={() => setSelectedAckForView(null)}
          className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-white my-8"
          >
            <div className="flex justify-between items-center p-6 bg-slate-900 border-b border-slate-850">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" /> Acknowledgment Sign-off Detail
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Defensible electronic confirmation record metadata</p>
              </div>
              <button 
                onClick={() => setSelectedAckForView(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingAckDetail ? (
              <div className="p-12 flex flex-col justify-center items-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-450 font-semibold animate-pulse">Loading receipt ledger...</span>
              </div>
            ) : ackViewDetail ? (
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                {/* Employee & Dept Info */}
                <div className="grid grid-cols-2 gap-4 bg-[#070b14] p-4 rounded-xl border border-slate-850">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Employee</span>
                    <span className="text-xs font-bold text-white mt-1 block">{ackViewDetail.employee_name}</span>
                    <span className="text-[10px] text-slate-450 font-mono block">ID: {ackViewDetail.employee_id}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Department</span>
                    <span className="text-xs font-bold text-white mt-1 block">{ackViewDetail.department || 'IT Operations'}</span>
                    <span className="text-[10px] text-slate-450 font-mono block">Email: {ackViewDetail.employee_email}</span>
                  </div>
                </div>

                {/* Policy details */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-850 space-y-2">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Policy Reference</span>
                    <span className="text-xs font-bold text-indigo-400 mt-1 block">
                      {ackViewDetail.policy_title || 'Corporate Compliance Agreement'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-400 pt-1.5 border-t border-slate-850">
                    <div>Version: <span className="text-slate-200 font-bold">{ackViewDetail.policy_version || '1.0'}</span></div>
                    <div>Status: <span className={cn(
                      "font-bold uppercase",
                      ackViewDetail.status === 'SIGNED' ? "text-emerald-450" : ackViewDetail.status === 'OVERDUE' ? "text-red-400" : "text-amber-400"
                    )}>{ackViewDetail.status === 'SIGNED' ? 'Acknowledged' : ackViewDetail.status}</span></div>
                  </div>
                </div>

                {/* Signature details */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-850 space-y-2.5 text-xs text-slate-350">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-450">Acknowledgment Date:</span>
                    <span className="font-bold text-white font-mono">{ackViewDetail.signed_at ? new Date(ackViewDetail.signed_at).toLocaleString() : 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-450">Signing IP Source:</span>
                    <span className="font-bold text-white font-mono">{ackViewDetail.signed_ip_address || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-450">Acknowledgment ID:</span>
                    <span className="font-bold text-slate-300 font-mono">{ackViewDetail.acknowledgment_id || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-450">Signing Method:</span>
                    <span className="font-bold text-slate-350">{ackViewDetail.authentication_method || 'JWT_LOGIN'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Browser User Agent:</span>
                    <p className="text-[10px] text-slate-400 font-mono bg-slate-950/40 p-2 rounded border border-slate-850/60 leading-relaxed max-h-16 overflow-y-auto">
                      {ackViewDetail.user_agent || 'Mozilla/5.0 (System)'}
                    </p>
                  </div>
                </div>

                {/* SHA & receipt hashes */}
                <div className="p-4 rounded-xl bg-[#0b0f1a] border border-slate-850 text-[10px] space-y-2 font-mono">
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500">Policy document SHA-256</span>
                    <span className="text-slate-400 break-all select-all block mt-0.5">{ackViewDetail.policy_document_sha256 || 'Unavailable'}</span>
                  </div>
                  <div className="border-t border-slate-900 pt-2">
                    <span className="block text-[8px] uppercase font-bold text-slate-500">Audit ledger receipt hash</span>
                    <span className="text-emerald-500 break-all select-all font-bold block mt-0.5">{ackViewDetail.receipt_hash || 'Unavailable'}</span>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs italic">
                Failed to populate acknowledgment detail metrics.
              </div>
            )}

            <div className="p-4 bg-slate-900/60 border-t border-slate-850 flex justify-end">
              <button 
                onClick={() => setSelectedAckForView(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offscreen Printable Report */}
      <PrintableAuditReport auditData={activeAuditData} />

      {/* Offscreen Acknowledgment Receipt PDF Download for HR */}
      {selectedReceiptForDownload && (
        <div className="absolute top-[-9999px] left-[-9999px]">
          <div className="p-8 bg-white text-slate-800 border border-slate-200 space-y-6 w-[8.5in]" id="hr-acknowledgment-receipt-pdf-download">
            <div className="border-b-2 border-slate-300 pb-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Security-HQ Compliance & Auditing Portal</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">ELECTRONIC PLEDGE ACKNOWLEDGMENT SYSTEM</p>
              </div>
              <span className="px-3 py-1.5 text-xs font-extrabold tracking-wider bg-emerald-100 text-emerald-800 rounded border border-emerald-300 uppercase">
                {selectedReceiptForDownload.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm font-semibold">
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400">Acknowledgment ID</span>
                <span className="text-slate-900 font-mono mt-0.5 block">{selectedReceiptForDownload.acknowledgment_id}</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400">Signed Timestamp (UTC)</span>
                <span className="text-slate-900 mt-0.5 block">{selectedReceiptForDownload.signed_at}</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400">Signer Profile</span>
                <span className="text-slate-900 mt-0.5 block">{selectedReceiptForDownload.employee_name} ({selectedReceiptForDownload.employee_id})</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400">Registered Email</span>
                <span className="text-slate-900 mt-0.5 block">{selectedReceiptForDownload.employee_email}</span>
              </div>
              <div className="col-span-2 border-t border-slate-200 pt-3">
                <span className="block text-xs uppercase tracking-wider text-slate-400">Policy Title & Reference</span>
                <span className="text-slate-900 mt-0.5 block font-bold text-base">{selectedReceiptForDownload.policy_id} - Corporate Compliance Agreement</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400">Document Signature Type</span>
                <span className="text-slate-900 mt-0.5 block">{selectedReceiptForDownload.signature_type} (Typed signature matching legal name)</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400">Client Source IP (HR Auditor Logged)</span>
                <span className="text-slate-900 mt-0.5 block font-mono">{selectedReceiptForDownload.signed_ip_address}</span>
              </div>
              <div className="col-span-2 border-t border-slate-200 pt-3">
                <span className="block text-xs uppercase tracking-wider text-slate-400">Policy Document SHA-256 Fingerprint</span>
                <span className="text-sm text-slate-700 font-mono mt-0.5 block break-all">
                  {selectedReceiptForDownload.policy_document_sha256}
                </span>
              </div>
              <div className="col-span-2 border-t border-slate-200 pt-3">
                <span className="block text-xs uppercase tracking-wider text-slate-400">Tamper-Evident Cryptographic Hash</span>
                <span className="text-sm text-slate-700 font-mono mt-0.5 block break-all font-bold">
                  {selectedReceiptForDownload.receipt_hash}
                </span>
              </div>
            </div>

            <div className="border-t-2 border-slate-300 pt-4 text-xs text-slate-500 text-center leading-relaxed font-medium">
              This document constitutes a binding record of electronic acknowledgment under standard identity verification and organization policy rules. Tamper-evident audits check hashes dynamically on every session.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}