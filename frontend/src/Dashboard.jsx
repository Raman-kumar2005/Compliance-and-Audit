import React, { useState, useEffect, useMemo } from 'react';
import AuditComparison from './components/AuditComparison';
import RiskScoreCard from './components/RiskScoreCard';
import ComplianceBreakdownCard from './components/ComplianceBreakdownCard';
import AISummaryBox from './components/AISummaryBox';
import MitigationModal from './components/MitigationModal';
import FrequentPoliciesCard from './components/FrequentPoliciesCard';
import PrintableAuditReport from './components/PrintableAuditReport';
import SLAStatusIndicator from './components/SLAStatusIndicator';
import UserInvitationModal from './components/UserInvitationModal';
import EvidenceModal from './components/EvidenceModal';
import EmployeeNotificationModal from './components/EmployeeNotificationModal';
import { 
  Upload, AlertTriangle, ShieldAlert, FileText, Loader2, 
  Sparkles, Download, Search, 
  ArrowRight, FileSpreadsheet, History, PlusCircle, ArrowLeft, Clock, LogOut, GitCompare,
  ArrowUpDown, User, X, Lock, Building, CheckCircle2, XCircle, Circle, Eye, UserPlus, FileCheck2,
  TrendingUp, TrendingDown, Send, Info, Play, Settings
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

export default function Dashboard({ user, onLogout, onSwitchTenant }) {
  const [activeTab, setActiveTab] = useState('new_audit'); // 'new_audit', 'history', 'compare', 'report'
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedEvidenceViolation, setSelectedEvidenceViolation] = useState(null);
  const [selectedNotifyViolationId, setSelectedNotifyViolationId] = useState(null);
  const [notificationToastMsg, setNotificationToastMsg] = useState('');

  const isHR = useMemo(() => {
    if (!user || (!user.role && !user.rawRole)) return true;
    const r = String(user.rawRole || user.role).toUpperCase();
    return r.includes('HR') || r.includes('COMPLIANCE') || r.includes('AUDITOR') || r.includes('ADMIN');
  }, [user]);

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
  const [isDraggingPolicy, setIsDraggingPolicy] = useState(false);
  const [isDraggingLog, setIsDraggingLog] = useState(false);

  const canRunAudit = useMemo(() => policyFiles.length > 0 && logFiles.length > 0, [policyFiles, logFiles]);

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
        setPolicyError(`Unsupported file type ("${f.name}"). Please upload a supported policy document (.pdf, .txt).`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setPolicyError(`File is too large ("${f.name}"). Please choose a smaller file under 5 MB.`);
        return;
      }
      validated.push(f);
    }

    const currentTotalSize = [...policyFiles, ...logFiles].reduce((acc, f) => acc + f.size, 0);
    const addedSize = validated.reduce((acc, f) => acc + f.size, 0);
    if (currentTotalSize + addedSize > 20 * 1024 * 1024) {
      setPolicyError('Total combined upload size exceeds the 20 MB limit. Please choose smaller files.');
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
        setLogError(`Unsupported file type ("${f.name}"). Please upload a supported logs file (.csv, .txt, .json).`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setLogError(`File is too large ("${f.name}"). Please choose a smaller file under 5 MB.`);
        return;
      }
      validated.push(f);
    }

    const currentTotalSize = [...policyFiles, ...logFiles].reduce((acc, f) => acc + f.size, 0);
    const addedSize = validated.reduce((acc, f) => acc + f.size, 0);
    if (currentTotalSize + addedSize > 20 * 1024 * 1024) {
      setLogError('Total combined upload size exceeds the 20 MB limit. Please choose smaller files.');
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
  const [slaStatusFilter, setSlaStatusFilter] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'CRITICAL' | 'DUE_SOON' | 'OPEN' | 'RESOLVED'
  const [slaSearchQuery, setSlaSearchQuery] = useState('');
  const [confirmEscalateItem, setConfirmEscalateItem] = useState(null);
  const [escalatedItems, setEscalatedItems] = useState({});
  const [showSlaConfigDrawer, setShowSlaConfigDrawer] = useState(false);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (confirmEscalateItem) setConfirmEscalateItem(null);
        if (selectedAckForView) setSelectedAckForView(null);
        if (selectedViolation) setSelectedViolation(null);
        if (showInviteModal) setShowInviteModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmEscalateItem, selectedAckForView, selectedViolation, showInviteModal]);

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
      fetchViolations();
      fetchSlaSettings();
      fetchSlaSummary();
    }
  }, [activeTab, user]);



  // HR Acknowledgment Stats
  const totalRequired = useMemo(() => hrAcks.length, [hrAcks]);
  const signedCount = useMemo(() => hrAcks.filter(a => a.status === 'SIGNED' || a.status === 'ACKNOWLEDGED').length, [hrAcks]);
  const pendingCount = useMemo(() => hrAcks.filter(a => a.status === 'PENDING').length, [hrAcks]);
  const overdueAcksCount = useMemo(() => hrAcks.filter(a => a.status === 'OVERDUE').length, [hrAcks]);
  const completionRate = useMemo(() => {
    if (totalRequired === 0) return '0.0';
    return ((signedCount / totalRequired) * 100).toFixed(1);
  }, [totalRequired, signedCount]);

  const policyCoverageList = useMemo(() => {
    if (!hrAcks || hrAcks.length === 0) return [];
    const policyMap = {};
    hrAcks.forEach(ack => {
      const title = ack.policy_title || 'General Compliance Policy';
      if (!policyMap[title]) {
        policyMap[title] = { total: 0, acknowledged: 0 };
      }
      policyMap[title].total += 1;
      if (ack.status === 'SIGNED' || ack.status === 'ACKNOWLEDGED') {
        policyMap[title].acknowledged += 1;
      }
    });

    return Object.entries(policyMap).map(([title, stats]) => {
      const pct = stats.total > 0 ? Math.round((stats.acknowledged / stats.total) * 100) : 0;
      return {
        title,
        percentage: pct,
        acknowledged: stats.acknowledged,
        total: stats.total
      };
    }).sort((a, b) => a.percentage - b.percentage);
  }, [hrAcks]);

  const filteredHrAcks = useMemo(() => {
    return hrAcks.filter(ack => {
      const matchesDept = filterAckDept === 'ALL' || ack.department === filterAckDept;
      const matchesPolicy = filterAckPolicy === 'ALL' || ack.policy_id === filterAckPolicy || ack.policy_title === filterAckPolicy;
      const matchesStatus = filterAckStatus === 'ALL' || 
        (filterAckStatus === 'SIGNED' && (ack.status === 'SIGNED' || ack.status === 'ACKNOWLEDGED')) ||
        ack.status === filterAckStatus;
      
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
    setHistoryError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/history`, { headers: authHeader });
      setHistoryData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setHistoryError("We couldn’t load audit history. Please try again.");
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
        const violationsList = Array.isArray(data.violations) ? data.violations : (Array.isArray(data) ? data : []);
        const fallbackMetrics = {
          total_flagged_violations: violationsList.length,
          high_severity_count: violationsList.filter(v => ['HIGH', 'CRITICAL'].includes((v.severity || '').toUpperCase())).length,
          compliance_score: Math.max(0, 100 - (violationsList.length * 10)),
          status: violationsList.length === 0 ? 'FULLY_COMPLIANT' : 'NEEDS_ATTENTION'
        };

        const finalMetrics = (data.metrics && typeof data.metrics === 'object' && Object.keys(data.metrics).length > 0)
          ? data.metrics
          : fallbackMetrics;

        setAuditData({
          ...MOCK_RESULTS,
          ...data,
          metrics: finalMetrics,
          violations: violationsList
        });
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

  // SLA & Escalations KPI summary calculations
  const slaKpis = useMemo(() => {
    const now = new Date();
    let openEscalations = 0;
    let criticalFindings = 0;
    let dueWithin24Hours = 0;
    let overdue = 0;
    let resolvedThisPeriod = 0;

    displayViolations.forEach(v => {
      const status = (v.status || '').toUpperCase();
      const sev = (v.severity || '').toUpperCase();
      const sla = v.sla || {};
      const slaStatus = sla.sla_status || '';
      const isEscalated = (sla.escalation_level || 0) > 0 || slaStatus === 'ESCALATED' || !!escalatedItems[v.id];
      
      let isOverdue = slaStatus === 'BREACHED' || slaStatus === 'ACKNOWLEDGMENT_OVERDUE';
      let isDueSoon = ['WARNING_80', 'WARNING_50'].includes(slaStatus);

      if (sla.resolution_due_at) {
        try {
          const cleaned = sla.resolution_due_at.endsWith('Z') ? sla.resolution_due_at : sla.resolution_due_at + 'Z';
          const due = new Date(cleaned);
          const diffMs = due - now;
          if (diffMs < 0 && status !== 'RESOLVED' && status !== 'CLOSED') {
            isOverdue = true;
          } else if (diffMs > 0 && diffMs <= 24 * 3600 * 1000 && status !== 'RESOLVED' && status !== 'CLOSED') {
            isDueSoon = true;
          }
        } catch (e) {}
      }

      if (status === 'RESOLVED' || status === 'CLOSED') {
        resolvedThisPeriod += 1;
      } else {
        if (isEscalated) openEscalations += 1;
        if (sev === 'CRITICAL') criticalFindings += 1;
        if (isOverdue) overdue += 1;
        else if (isDueSoon) dueWithin24Hours += 1;
      }
    });

    return {
      openEscalations,
      criticalFindings,
      dueWithin24Hours,
      overdue,
      resolvedThisPeriod
    };
  }, [displayViolations, escalatedItems]);

  // SLA filtered and sorted findings list (Priority: 1. Overdue, 2. Critical & Due soon, 3. High severity, 4. Open, 5. Resolved)
  const slaFilteredAndSortedFindings = useMemo(() => {
    const now = new Date();

    const enriched = displayViolations.map(v => {
      const status = (v.status || 'OPEN').toUpperCase();
      const sev = (v.severity || 'MEDIUM').toUpperCase();
      const sla = v.sla || {};
      const slaStatus = sla.sla_status || 'ON_TRACK';
      const isEscalated = (sla.escalation_level || 0) > 0 || slaStatus === 'ESCALATED' || !!escalatedItems[v.id];
      
      let isOverdue = slaStatus === 'BREACHED' || slaStatus === 'ACKNOWLEDGMENT_OVERDUE';
      let isDueSoon = ['WARNING_80', 'WARNING_50'].includes(slaStatus);
      let timeRemainingText = '';
      let deadlineFormatted = 'Standard SLA';

      if (sla.resolution_due_at) {
        try {
          const cleaned = sla.resolution_due_at.endsWith('Z') ? sla.resolution_due_at : sla.resolution_due_at + 'Z';
          const due = new Date(cleaned);
          deadlineFormatted = due.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const diffMs = due - now;
          const diffHours = Math.round(diffMs / (3600 * 1000));
          const diffDays = Math.round(diffMs / (24 * 3600 * 1000));

          if (status === 'RESOLVED' || status === 'CLOSED') {
            timeRemainingText = `Resolved${sla.resolved_at ? ` on ${new Date(sla.resolved_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`;
          } else if (diffMs < 0) {
            isOverdue = true;
            const pastDays = Math.max(1, Math.abs(diffDays));
            timeRemainingText = `Overdue by ${pastDays === 1 ? '1 day' : `${pastDays} days`}`;
          } else if (diffHours <= 1) {
            isDueSoon = true;
            timeRemainingText = `SLA expires in < 1 hour`;
          } else if (diffHours < 24) {
            isDueSoon = true;
            timeRemainingText = `SLA expires in ${diffHours} hours`;
          } else if (diffDays === 1) {
            isDueSoon = true;
            timeRemainingText = `Due tomorrow`;
          } else {
            timeRemainingText = `Due in ${diffDays} days`;
          }
        } catch (e) {}
      } else if (status === 'RESOLVED' || status === 'CLOSED') {
        timeRemainingText = 'Resolved';
      } else {
        timeRemainingText = isEscalated ? 'Escalated to Lead' : 'Within SLA';
      }

      // Compute Urgency Category
      let urgency = 'OPEN';
      if (status === 'RESOLVED' || status === 'CLOSED') urgency = 'RESOLVED';
      else if (isOverdue) urgency = 'OVERDUE';
      else if (isEscalated) urgency = 'ESCALATED';
      else if (sev === 'CRITICAL') urgency = 'CRITICAL';
      else if (isDueSoon) urgency = 'DUE_SOON';

      // Sort Priority rank: Overdue (1), Critical/Due Soon/Escalated (2), High (3), Open (4), Resolved (5)
      let sortPriority = 4;
      if (urgency === 'OVERDUE') sortPriority = 1;
      else if (urgency === 'CRITICAL' || urgency === 'DUE_SOON' || urgency === 'ESCALATED') sortPriority = 2;
      else if (sev === 'HIGH') sortPriority = 3;
      else if (urgency === 'OPEN') sortPriority = 4;
      else if (urgency === 'RESOLVED') sortPriority = 5;

      return {
        ...v,
        computedUrgency: urgency,
        computedIsOverdue: isOverdue,
        computedIsDueSoon: isDueSoon,
        computedTimeRemaining: timeRemainingText,
        computedDeadlineFormatted: deadlineFormatted,
        sortPriority
      };
    });

    // Apply Filter
    const filtered = enriched.filter(item => {
      if (slaStatusFilter === 'OPEN' && item.computedUrgency === 'RESOLVED') return false;
      if (slaStatusFilter === 'CRITICAL' && (item.severity || '').toUpperCase() !== 'CRITICAL') return false;
      if (slaStatusFilter === 'DUE_SOON' && !item.computedIsDueSoon) return false;
      if (slaStatusFilter === 'OVERDUE' && !item.computedIsOverdue) return false;
      if (slaStatusFilter === 'RESOLVED' && item.computedUrgency !== 'RESOLVED') return false;

      if (slaSearchQuery) {
        const q = slaSearchQuery.toLowerCase();
        const matches = 
          (item.rule_violated || '').toLowerCase().includes(q) ||
          (item.employee || '').toLowerCase().includes(q) ||
          (item.assigned_employee_name || '').toLowerCase().includes(q) ||
          (item.assigned_employee_id || '').toLowerCase().includes(q) ||
          (item.department || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    // Sort by priority rank first, then ID
    return filtered.sort((a, b) => a.sortPriority - b.sortPriority);
  }, [displayViolations, slaStatusFilter, slaSearchQuery, escalatedItems]);

  const handleConfirmEscalation = async () => {
    if (!confirmEscalateItem) return;
    const vId = confirmEscalateItem.id;
    setEscalatedItems(prev => ({ ...prev, [vId]: true }));
    setConfirmEscalateItem(null);
    setSlaSettingsSaveSuccess("Demo escalation recorded successfully. Compliance owner notified.");
    setTimeout(() => setSlaSettingsSaveSuccess(''), 4000);
  };

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

  const currentScore = useMemo(() => {
    if (simulatedState === 'high-risk') return 22;
    return auditData?.metrics?.compliance_score ?? metrics?.compliance_score ?? 84;
  }, [simulatedState, auditData, metrics]);

  const scoreStatus = useMemo(() => {
    if (currentScore >= 80) {
      return {
        label: 'Compliant',
        colorClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        badgeColor: 'text-emerald-400',
        isCompliant: true
      };
    } else if (currentScore >= 60) {
      return {
        label: 'Needs Attention',
        colorClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        badgeColor: 'text-amber-400',
        isCompliant: false
      };
    } else {
      return {
        label: 'Action Required',
        colorClass: 'bg-red-500/10 border-red-500/30 text-red-400',
        badgeColor: 'text-red-400',
        isCompliant: false
      };
    }
  }, [currentScore]);

  const scoreDiff = useMemo(() => {
    const trend = metrics?.compliance_trend || [];
    if (trend.length >= 2) {
      return trend[trend.length - 1] - trend[trend.length - 2];
    }
    return 0;
  }, [metrics]);

  const criticalFindingsCount = useMemo(() => {
    return displayViolations.filter(v => ['CRITICAL', 'HIGH'].includes((v.severity || '').toUpperCase())).length;
  }, [displayViolations]);

  const pendingActionsCount = useMemo(() => {
    return displayViolations.filter(v => ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'REQUIRES_CHANGES', 'REOPENED'].includes((v.status || '').toUpperCase())).length;
  }, [displayViolations]);

  const openEscalationsCount = useMemo(() => {
    return displayViolations.filter(v => v.sla?.escalation_level > 0 || (v.sla?.sla_status || '') === 'ESCALATED').length;
  }, [displayViolations]);

  const topDepartmentsList = useMemo(() => {
    const deptMap = {};
    displayViolations.forEach(v => {
      const dept = v.department || 'Operations';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    return Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
  }, [displayViolations]);

  const mainDriverText = useMemo(() => {
    if (displayViolations.length === 0) {
      return "All policy parameters adhere to compliance standards with 0 active violations.";
    }
    const topDepts = topDepartmentsList.slice(0, 2).map(([d]) => d).join(' and ') || 'Operations';
    return `${displayViolations.length} violations detected, primarily in ${topDepts}.`;
  }, [displayViolations, topDepartmentsList]);

  const primaryRecommendationText = useMemo(() => {
    const highest = displayViolations.find(v => (v.severity || '').toUpperCase() === 'CRITICAL') || displayViolations[0];
    if (!highest) return "Maintain existing periodic policy audit cycle.";
    return highest.recommendation || "Initiate standard remediation and update credential authorization.";
  }, [displayViolations]);

  const domainScores = useMemo(() => {
    const scores = { 'Access Control': 91, 'Authentication & IAM': 88, 'Data Protection': 82, 'Employee Policy': 76, 'Financial Approval': 95 };
    displayViolations.forEach(v => {
      const rule = (v.rule_violated || '').toLowerCase();
      const explanation = (v.explanation || '').toLowerCase();
      const text = `${rule} ${explanation}`;
      const sev = (v.severity || 'Medium').toUpperCase();
      const deduction = sev === 'CRITICAL' ? 14 : sev === 'HIGH' ? 8 : 4;

      if (text.includes('access') || text.includes('key') || text.includes('permission')) {
        scores['Access Control'] = Math.max(20, scores['Access Control'] - deduction);
      } else if (text.includes('auth') || text.includes('mfa') || text.includes('password') || text.includes('login')) {
        scores['Authentication & IAM'] = Math.max(25, scores['Authentication & IAM'] - deduction);
      } else if (text.includes('data') || text.includes('leak') || text.includes('exfiltration') || text.includes('pii')) {
        scores['Data Protection'] = Math.max(15, scores['Data Protection'] - deduction);
      } else if (text.includes('training') || text.includes('policy') || text.includes('hour') || text.includes('sign')) {
        scores['Employee Policy'] = Math.max(20, scores['Employee Policy'] - deduction);
      } else if (text.includes('finance') || text.includes('wire') || text.includes('approval')) {
        scores['Financial Approval'] = Math.max(30, scores['Financial Approval'] - deduction);
      }
    });

    return Object.entries(scores).map(([name, score]) => ({ name, score }));
  }, [displayViolations]);

  const priorityFindings = useMemo(() => {
    const sorted = [...displayViolations].sort((a, b) => {
      const sevA = (SEVERITY_WEIGHT[(a.severity || 'LOW').toUpperCase()] || 1);
      const sevB = (SEVERITY_WEIGHT[(b.severity || 'LOW').toUpperCase()] || 1);
      return sevB - sevA;
    });
    return sorted.slice(0, 4);
  }, [displayViolations, SEVERITY_WEIGHT]);

  const historySummary = useMemo(() => {
    if (!historyData || historyData.length === 0) {
      return null;
    }
    const latestAudit = historyData[0];
    const previousAudit = historyData.length > 1 ? historyData[1] : null;

    const latestScore = latestAudit?.metrics?.compliance_score ?? null;
    const prevScore = previousAudit?.metrics?.compliance_score ?? null;
    const scoreDiff = (latestScore !== null && prevScore !== null) ? (latestScore - prevScore) : null;

    return {
      latestScore,
      prevScore,
      scoreDiff,
      totalAudits: historyData.length
    };
  }, [historyData]);

  const historyTrendData = useMemo(() => {
    if (!historyData || historyData.length < 2) return [];
    // Sort chronologically (oldest first)
    const sorted = [...historyData].sort((a, b) => {
      const dateA = new Date(a.timestamp || 0).getTime();
      const dateB = new Date(b.timestamp || 0).getTime();
      return dateA - dateB;
    });

    return sorted.map((record, index) => {
      const date = record.timestamp ? new Date(record.timestamp) : new Date();
      const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const score = record.metrics?.compliance_score ?? 0;
      const violationsCount = record.violations?.length ?? 0;
      return {
        id: record.id || index,
        dateLabel,
        fullDate: date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        score,
        violationsCount,
        policyName: record.policy_filename || 'Policy Document'
      };
    });
  }, [historyData]);

  const filteredHistoryData = useMemo(() => {
    if (historyStatusFilter === 'ALL') return historyData;
    return historyData.filter(record => {
      const score = record.metrics?.compliance_score ?? 0;
      if (historyStatusFilter === 'COMPLIANT') return score >= 80;
      if (historyStatusFilter === 'NEEDS_ATTENTION') return score >= 60 && score < 80;
      if (historyStatusFilter === 'CRITICAL') return score < 60;
      return true;
    });
  }, [historyData, historyStatusFilter]);

  const historyFilterCounts = useMemo(() => {
    const total = historyData.length;
    const compliant = historyData.filter(r => (r.metrics?.compliance_score ?? 0) >= 80).length;
    const needsAttention = historyData.filter(r => {
      const score = r.metrics?.compliance_score ?? 0;
      return score >= 60 && score < 80;
    }).length;
    const critical = historyData.filter(r => (r.metrics?.compliance_score ?? 0) < 60).length;

    return { total, compliant, needsAttention, critical };
  }, [historyData]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      
      {/* Navigation Bar */}
      <nav className="bg-[#1e293b] border-b border-slate-700/50 no-print">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-indigo-500" /> 
            <div>
              <span className="text-xl font-bold text-white tracking-tight block">AI Auditor</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block -mt-0.5">HR Operations</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Organization Badge or Multi-Tenant Selector */}
            {user?.authorized_tenants && user.authorized_tenants.length > 1 ? (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f172a] border border-purple-500/40 text-xs font-semibold text-purple-300 shadow-sm">
                <Building className="w-3.5 h-3.5 text-purple-400" />
                <select
                  value={user.tenant_id}
                  onChange={(e) => onSwitchTenant && onSwitchTenant(e.target.value)}
                  className="bg-transparent text-purple-200 text-xs font-bold focus:outline-none cursor-pointer pr-1"
                >
                  {user.authorized_tenants.map(t => (
                    <option key={t.tenant_id} value={t.tenant_id} className="bg-slate-900 text-white font-medium">
                      {t.company_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : user?.company_name ? (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-800 text-xs font-semibold text-indigo-400">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                <span>{user.company_name}</span>
              </div>
            ) : null}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-800 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>{user?.email || 'hr.officer@technova-demo.com'}</span>
              <span className="text-[9px] bg-purple-500/15 text-purple-400 font-extrabold px-1.5 py-0.5 rounded border border-purple-500/25 uppercase">{user?.rawRole || user?.role || 'HR Compliance Officer'}</span>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite Team
            </button>
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
          <div className="max-w-7xl mx-auto p-6 md:px-12 md:py-8 w-full animate-in fade-in zoom-in-95 duration-300">
            {loading && auditStage >= 0 ? (
              <div className="max-w-xl mx-auto bg-[#0f172a] p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-350 my-12">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      auditProgressError ? "bg-red-500" : "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
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

                <div className="space-y-3 my-6">
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
                                : "bg-[#090d16]/40 border-slate-850 text-slate-500"
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
                        {isFailed && <span className="text-[10px] uppercase font-extrabold tracking-wider text-red-400">Failed</span>}
                      </div>
                    );
                  })}
                </div>

                {auditProgressError && (
                  <div className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 space-y-3">
                    <p className="font-semibold leading-relaxed">
                      {auditProgressError}
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={handleAudit}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors"
                      >
                        Retry Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoading(false);
                          setAuditStage(-1);
                          setAuditProgressError('');
                        }}
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 1. Page Title and Organization Context */}
                <header className="mb-6 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] bg-purple-500/15 text-purple-400 font-extrabold px-2.5 py-0.5 rounded border border-purple-500/25 uppercase tracking-wider">
                        {user?.rawRole || user?.role || 'HR Compliance Officer'}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        Organization: <strong className="text-white font-bold">{user?.company_name || 'TechNova Technologies'}</strong>
                      </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">New Audit</h1>
                    <p className="text-slate-400 mt-1.5 text-sm">Upload a company policy and system logs to identify compliance risks.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={loadDemoData}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                      title="Load pre-configured demo audit data"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Load Demo Preview Data
                    </button>
                  </div>
                </header>

                {/* Demo Mode Notice if Active */}
                {isDemoMode && (
                  <div className="mb-6 p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl flex items-center gap-3 text-xs font-medium no-print">
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <strong className="font-bold text-amber-200">Demo Mode Active:</strong> Showing preloaded audit data for demonstration.
                    </div>
                  </div>
                )}

                {/* Helpful Guidance Tip */}
                <div className="mb-6 p-4 bg-[#090d16] border border-slate-850 rounded-2xl flex items-center gap-3 text-xs text-slate-400">
                  <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>
                    <strong className="text-slate-200 font-bold">Tip:</strong> Use the latest approved policy document and a system-log file from the same audit period.
                  </span>
                </div>

                {/* 2. Upload Cards Sequence */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Policy Upload Card */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingPolicy(true); }}
                    onDragLeave={() => setIsDraggingPolicy(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPolicy(false);
                      if (e.dataTransfer.files) handleAddPolicyFiles(e.dataTransfer.files);
                    }}
                    className={cn(
                      "bg-[#0f172a] p-6 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col justify-between transition-all",
                      isDraggingPolicy ? "border-indigo-500 bg-indigo-950/20" : "border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white tracking-tight">Company Policy Document</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Upload the policy document used to evaluate compliance.</p>
                          </div>
                        </div>
                        {policyFiles.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                      </div>

                      {/* Upload trigger zone */}
                      <div className="my-4 p-5 bg-[#090d16] border border-dashed border-slate-700/80 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
                        <Upload className="w-6 h-6 text-indigo-400" />
                        <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl cursor-pointer font-bold text-xs transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2">
                          <span>Upload Policy</span>
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
                        <span className="text-[11px] text-slate-500 font-medium">Accepted formats: PDF, TXT</span>
                      </div>

                      {/* Selected Files List */}
                      {policyFiles.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold mb-1">
                            <span>Selected Policy ({policyFiles.length})</span>
                            <button
                              type="button"
                              onClick={() => { setPolicyFiles([]); setPolicyError(''); }}
                              className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              Remove All
                            </button>
                          </div>
                          {policyFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-[#090d16] px-3.5 py-2.5 rounded-xl text-xs border border-slate-850">
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                <span className="text-slate-200 font-semibold truncate">{file.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Ready for audit
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => setPolicyFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                                  title="Remove file"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-1 text-center">
                          Upload the required files to begin your compliance audit.
                        </div>
                      )}
                    </div>

                    {policyError && (
                      <div className="mt-4 text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" /> {policyError}
                      </div>
                    )}
                  </div>

                  {/* System Logs Upload Card */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingLog(true); }}
                    onDragLeave={() => setIsDraggingLog(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingLog(false);
                      if (e.dataTransfer.files) handleAddLogFiles(e.dataTransfer.files);
                    }}
                    className={cn(
                      "bg-[#0f172a] p-6 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col justify-between transition-all",
                      isDraggingLog ? "border-emerald-500 bg-emerald-950/20" : "border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white tracking-tight">System Logs File</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Upload the employee or system activity logs to analyze.</p>
                          </div>
                        </div>
                        {logFiles.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                      </div>

                      {/* Upload trigger zone */}
                      <div className="my-4 p-5 bg-[#090d16] border border-dashed border-slate-700/80 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
                        <Upload className="w-6 h-6 text-emerald-400" />
                        <label className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl cursor-pointer font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2">
                          <span>Upload Logs</span>
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
                        <span className="text-[11px] text-slate-500 font-medium">Accepted formats: CSV, TXT, JSON</span>
                      </div>

                      {/* Selected Files List */}
                      {logFiles.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold mb-1">
                            <span>Selected Logs ({logFiles.length})</span>
                            <button
                              type="button"
                              onClick={() => { setLogFiles([]); setLogError(''); }}
                              className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              Remove All
                            </button>
                          </div>
                          {logFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-[#090d16] px-3.5 py-2.5 rounded-xl text-xs border border-slate-850">
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <span className="text-slate-200 font-semibold truncate">{file.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Ready for audit
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => setLogFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                                  title="Remove file"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-1 text-center">
                          Upload the required files to begin your compliance audit.
                        </div>
                      )}
                    </div>

                    {logError && (
                      <div className="mt-4 text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" /> {logError}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Audit Readiness Summary Indicator */}
                <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Audit Readiness</h4>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        {policyFiles.length > 0 ? (
                          <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4" /> Policy document: Ready ({policyFiles.length})
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Clock className="w-4 h-4 text-slate-500" /> Policy document: Pending upload
                          </span>
                        )}
                      </div>
                      <span className="text-slate-700 hidden sm:inline">•</span>
                      <div className="flex items-center gap-1.5">
                        {logFiles.length > 0 ? (
                          <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4" /> System logs: Ready ({logFiles.length})
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Clock className="w-4 h-4 text-slate-500" /> System logs: Pending upload
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!canRunAudit && (
                    <span className="text-xs text-amber-400/90 font-medium bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                      Upload both required files to start the audit.
                    </span>
                  )}
                </div>

                {/* 4. Primary Run Audit Action */}
                <button 
                  type="button"
                  onClick={handleAudit} 
                  disabled={loading || !canRunAudit}
                  className={cn(
                    "w-full py-4 rounded-2xl font-extrabold text-base flex justify-center items-center gap-2.5 transition-all shadow-xl",
                    canRunAudit && !loading
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 cursor-pointer"
                      : "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60"
                  )}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Preparing AI analysis...</>
                  ) : (
                    <><Play className="w-5 h-5 text-indigo-300" /> Run Audit</>
                  )}
                </button>

                {error && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" /> 
                      <div>
                        <h5 className="font-bold text-white">The audit could not be started.</h5>
                        <p className="text-slate-300 mt-0.5">{error}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAudit}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs cursor-pointer flex-shrink-0"
                    >
                      Retry
                    </button>
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
          <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 animate-in fade-in zoom-in-95 duration-300 space-y-8">
            
            {/* 1. Page Heading and Organization Context */}
            <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] bg-purple-500/15 text-purple-400 font-extrabold px-2.5 py-0.5 rounded border border-purple-500/25 uppercase tracking-wider">
                    {user?.rawRole || user?.role || 'HR Compliance Officer'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Organization: <strong className="text-white font-bold">{user?.company_name || 'TechNova Technologies'}</strong>
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  <Lock className="w-8 h-8 text-indigo-500" /> Policy Acknowledgments
                </h1>
                <p className="text-slate-400 text-sm mt-1.5 font-medium">
                  Track employee acknowledgment of required company policies.
                </p>
              </div>
            </header>

            {/* Reminder Status Alert */}
            {reminderStatusMessage && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-2xl font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{reminderStatusMessage}</span>
              </div>
            )}

            {/* 2. KPI Section (5 Cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Required</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{totalRequired}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Assigned policy pledges</span>
              </div>

              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">Acknowledged</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">{signedCount}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Completed sign-offs</span>
              </div>

              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">Pending</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{pendingCount}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Within expected timeline</span>
              </div>

              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-red-400 tracking-wider">Overdue</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-red-400 tracking-tight">{overdueAcksCount}</span>
                </div>
                <span className={cn(
                  "text-[10px] font-bold",
                  overdueAcksCount > 0 ? "text-red-400" : "text-slate-400"
                )}>
                  {overdueAcksCount > 0 ? "Requires Attention" : "None overdue"}
                </span>
              </div>

              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider">Completion Rate</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-indigo-400 tracking-tight">{completionRate}%</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Acknowledged ÷ Total</span>
              </div>
            </div>

            {/* 3. Policy Coverage Breakdown */}
            {policyCoverageList.length > 0 && (
              <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Policy Coverage</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Overall acknowledgment rates grouped by active policy</p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">{policyCoverageList.length} policies tracked</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {policyCoverageList.map((pol) => {
                    const isHigh = pol.percentage >= 90;
                    const isMid = pol.percentage >= 70;
                    const barColor = isHigh ? 'bg-emerald-500' : isMid ? 'bg-amber-500' : 'bg-red-500';
                    const textColor = isHigh ? 'text-emerald-400' : isMid ? 'text-amber-400' : 'text-red-400';

                    return (
                      <div key={pol.title} className="p-4 bg-[#090d16] rounded-2xl border border-slate-850 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white truncate max-w-[260px]">{pol.title}</span>
                          <span className={cn("font-extrabold", textColor)}>{pol.percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", barColor)}
                            style={{ width: `${Math.min(100, Math.max(0, pol.percentage))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>{pol.acknowledged} of {pol.total} acknowledged</span>
                          <span>Target: 100%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Table & Filters Card */}
            <div className="bg-[#0f172a] p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
              
              {/* Header and Toolbar */}
              <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 pb-6 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Acknowledgment Registry
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Showing {filteredHrAcks.length} of {hrAcks.length} logged assignments.</p>
                </div>

                {/* Filters Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status Quick Filter Buttons */}
                  <div className="flex items-center gap-1 bg-[#090d16] p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFilterAckStatus('ALL')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        filterAckStatus === 'ALL'
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      All ({totalRequired})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterAckStatus('SIGNED')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        filterAckStatus === 'SIGNED'
                          ? "bg-emerald-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Acknowledged ({signedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterAckStatus('PENDING')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        filterAckStatus === 'PENDING'
                          ? "bg-amber-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Pending ({pendingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterAckStatus('OVERDUE')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        filterAckStatus === 'OVERDUE'
                          ? "bg-red-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Overdue ({overdueAcksCount})
                    </button>
                  </div>

                  {/* Search Employee */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search employee..." 
                      value={searchAckEmpQuery}
                      onChange={(e) => setSearchAckEmpQuery(e.target.value)}
                      className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Table Body */}
              {loadingHrAcks ? (
                <div className="flex flex-col justify-center items-center py-16 gap-3 text-slate-400 text-xs font-semibold">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                  <span>Loading policy acknowledgments...</span>
                </div>
              ) : hrAcksError ? (
                <div className="p-8 bg-red-500/10 border border-red-500/30 text-center rounded-2xl max-w-md mx-auto space-y-3">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">We couldn’t load policy acknowledgments.</h4>
                  <p className="text-xs text-slate-400">Please try again.</p>
                  <button
                    type="button"
                    onClick={fetchHrAcks}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredHrAcks.length === 0 ? (
                <div className="p-12 bg-[#090d16] border border-slate-850 text-center rounded-2xl space-y-2">
                  <FileCheck2 className="w-10 h-10 text-slate-600 mx-auto mb-1" />
                  <h4 className="text-sm font-bold text-white">
                    {filterAckStatus === 'OVERDUE' 
                      ? "No overdue acknowledgments"
                      : filterAckStatus === 'PENDING'
                        ? "No pending acknowledgments"
                        : "No policy acknowledgments found"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {filterAckStatus === 'OVERDUE'
                      ? "All required acknowledgments are currently within their expected timeline."
                      : filterAckStatus === 'PENDING'
                        ? "All assigned policies have been acknowledged."
                        : "Required policies and employee acknowledgment records will appear here."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#090d16]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0f172a] text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Policy</th>
                        <th className="py-3 px-4">Policy Version</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Acknowledged Date</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-medium text-slate-300">
                      {filteredHrAcks.map((row, idx) => {
                        const isSigned = row.status === 'SIGNED' || row.status === 'ACKNOWLEDGED';
                        const isOverdue = row.status === 'OVERDUE';
                        const key = `${row.employee_id}_${row.policy_id}`;
                        
                        return (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className="font-extrabold text-white block">{row.employee_name}</span>
                              <span className="text-[10px] text-slate-500 block font-mono">{row.employee_id}</span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-300">{row.department}</td>
                            <td className="py-3.5 px-4 font-semibold text-slate-200">
                              {row.policy_title}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400">
                              {row.policy_version || 'v1.0'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider",
                                  isSigned 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                    : isOverdue 
                                      ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                )}>
                                  {isSigned ? 'Acknowledged' : isOverdue ? 'Overdue' : 'Pending'}
                                </span>
                                {isOverdue && (
                                  <span className="text-[9px] text-red-400/80 font-medium">Overdue</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400">
                              {row.signed_at ? new Date(row.signed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => handleViewAckDetail(row)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-400" /> View
                                </button>
                                {isSigned ? (
                                  <button 
                                    type="button"
                                    onClick={() => handleDownloadHrReceipt(row.acknowledgment_id)}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Receipt
                                  </button>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => sendReminderNotification(row)}
                                    disabled={!!sentReminders[key]}
                                    className={cn(
                                      "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                                      sentReminders[key]
                                        ? "bg-slate-800/40 border-slate-700/30 text-slate-500 cursor-not-allowed"
                                        : "bg-indigo-600 hover:bg-indigo-500 border-indigo-500/30 text-white"
                                    )}
                                  >
                                    {sentReminders[key] ? "Reminded" : "Remind"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Electronic Compliance Disclosure */}
            <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 text-xs">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ⚖️ <strong className="text-slate-300 font-bold">Electronic Compliance Disclosure:</strong> This ledger creates an auditable record of employee policy acknowledgments. Legal enforceability depends on applicable jurisdiction law, identity verification, and organization policy.
              </p>
            </div>
          </div>
        )}

        {/* VIEW: SLA & ESCALATIONS */}
        {activeTab === 'sla_settings' && (
          <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 animate-in fade-in zoom-in-95 duration-300 space-y-8">
            
            {/* 1. Page Heading and Organization Context */}
            <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] bg-purple-500/15 text-purple-400 font-extrabold px-2.5 py-0.5 rounded border border-purple-500/25 uppercase tracking-wider">
                    {user?.rawRole || user?.role || 'HR Compliance Officer'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Organization: <strong className="text-white font-bold">{user?.company_name || 'TechNova Technologies'}</strong>
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  <Clock className="w-8 h-8 text-indigo-500" /> SLA & Escalations
                </h1>
                <p className="text-slate-400 text-sm mt-1.5 font-medium">
                  Monitor remediation deadlines and escalate unresolved compliance findings.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setShowSlaConfigDrawer(!showSlaConfigDrawer)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  {showSlaConfigDrawer ? 'Hide SLA Policy Rules' : 'Configure SLA Policy Rules'}
                </button>
                <button 
                  type="button"
                  onClick={triggerSlaEvaluationChecker}
                  disabled={loadingSlaSettings || loadingSlaSummary}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Loader2 className={`w-3.5 h-3.5 ${loadingSlaSummary ? 'animate-spin' : ''}`} />
                  Evaluate SLAs
                </button>
              </div>
            </header>

            {/* Alert Messages */}
            {slaSettingsError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{slaSettingsError}</span>
              </div>
            )}
            {slaSettingsSaveSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-2xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{slaSettingsSaveSuccess}</span>
              </div>
            )}
            {reminderStatusMessage && (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs rounded-2xl font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>{reminderStatusMessage}</span>
              </div>
            )}

            {/* 2. Summary KPI Section (5 Cards in Priority Order) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. Overdue */}
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-red-400 tracking-wider">Overdue</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-red-400 tracking-tight">{slaKpis.overdue}</span>
                </div>
                <span className={cn(
                  "text-[10px] font-bold",
                  slaKpis.overdue > 0 ? "text-red-400" : "text-slate-400"
                )}>
                  {slaKpis.overdue > 0 ? "Breached remediation deadline" : "No breached items"}
                </span>
              </div>

              {/* 2. Critical Findings */}
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-orange-400 tracking-wider">Critical Findings</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{slaKpis.criticalFindings}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Highest severity risk</span>
              </div>

              {/* 3. Due Within 24 Hours */}
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">Due Within 24 Hours</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{slaKpis.dueWithin24Hours}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Approaching SLA threshold</span>
              </div>

              {/* 4. Open Escalations */}
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-purple-400 tracking-wider">Open Escalations</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-purple-400 tracking-tight">{slaKpis.openEscalations}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Active escalation alerts</span>
              </div>

              {/* 5. Resolved This Period */}
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">Resolved This Period</span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">{slaKpis.resolvedThisPeriod}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Remediated compliance issues</span>
              </div>
            </div>

            {/* 3. Collapsible SLA Configuration Section (Preserved & Styled) */}
            {showSlaConfigDrawer && slaSettings && (
              <div className="bg-[#0f172a] p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6 animate-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-indigo-400" /> SLA Policy Thresholds & Rules
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Customize acknowledgment and resolution time limits per finding severity</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSlaConfigDrawer(false)}
                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Short durations toggle */}
                <div className="bg-[#090d16] p-5 rounded-2xl border border-slate-850 flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Enable Short Demo SLA Durations</h4>
                    <p className="text-xs text-slate-400">Accelerates thresholds for testing: Critical = 2 mins, High = 5 mins. Level 2 escalations fire after 2 mins.</p>
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
                      <div key={sev} className="bg-[#090d16] p-6 rounded-2xl border border-slate-850 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">{sev} Policy</h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border",
                            sev === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            sev === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          )}>{sev}</span>
                        </div>
                        
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

                          <div className="border-t border-slate-850 pt-3 space-y-3">
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
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-850 rounded-xl text-slate-300 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => saveSlaSettings(slaSettings)}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-indigo-500/25 transition-all"
                  >
                    Save & Re-evaluate Policy Rules
                  </button>
                </div>
              </div>
            )}

            {/* 4. Remediation & Escalation Ledger Card */}
            <div className="bg-[#0f172a] p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
              
              {/* Header and Toolbar */}
              <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 pb-6 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Remediation & Escalation Registry
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing {slaFilteredAndSortedFindings.length} of {displayViolations.length} compliance findings sorted by priority.
                  </p>
                </div>

                {/* Filters Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status Quick Filter Tabs */}
                  <div className="flex items-center gap-1 bg-[#090d16] p-1 rounded-xl border border-slate-800 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSlaStatusFilter('ALL')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        slaStatusFilter === 'ALL'
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      All ({displayViolations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlaStatusFilter('OVERDUE')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        slaStatusFilter === 'OVERDUE'
                          ? "bg-red-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Overdue ({slaKpis.overdue})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlaStatusFilter('CRITICAL')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        slaStatusFilter === 'CRITICAL'
                          ? "bg-orange-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Critical ({slaKpis.criticalFindings})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlaStatusFilter('DUE_SOON')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        slaStatusFilter === 'DUE_SOON'
                          ? "bg-amber-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Due Soon ({slaKpis.dueWithin24Hours})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlaStatusFilter('OPEN')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        slaStatusFilter === 'OPEN'
                          ? "bg-purple-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Open ({displayViolations.filter(v => (v.status || '').toUpperCase() !== 'RESOLVED' && (v.status || '').toUpperCase() !== 'CLOSED').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlaStatusFilter('RESOLVED')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        slaStatusFilter === 'RESOLVED'
                          ? "bg-emerald-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Resolved ({slaKpis.resolvedThisPeriod})
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search findings, owners..." 
                      value={slaSearchQuery}
                      onChange={(e) => setSlaSearchQuery(e.target.value)}
                      className="w-full sm:w-52 pl-8 pr-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Table / Cards Body */}
              {loadingViolations ? (
                <div className="flex flex-col justify-center items-center py-16 gap-3 text-slate-400 text-xs font-semibold">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                  <span>Loading SLA and escalation records...</span>
                </div>
              ) : violationsError ? (
                <div className="p-8 bg-red-500/10 border border-red-500/30 text-center rounded-2xl max-w-md mx-auto space-y-3">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">We couldn’t load SLA and escalation records.</h4>
                  <p className="text-xs text-slate-400">Please try again.</p>
                  <button
                    type="button"
                    onClick={fetchViolations}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Retry
                  </button>
                </div>
              ) : slaFilteredAndSortedFindings.length === 0 ? (
                <div className="p-12 bg-[#090d16] border border-slate-850 text-center rounded-2xl space-y-2">
                  <Clock className="w-10 h-10 text-slate-600 mx-auto mb-1" />
                  <h4 className="text-sm font-bold text-white">
                    {slaStatusFilter === 'OVERDUE' 
                      ? "No overdue findings"
                      : slaStatusFilter === 'OPEN'
                        ? "No open escalations"
                        : "No SLA records found"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {slaStatusFilter === 'OVERDUE'
                      ? "There are currently no findings past their SLA deadline."
                      : slaStatusFilter === 'OPEN'
                        ? "All current findings are within their SLA or have been resolved."
                        : "Compliance findings with remediation deadlines will appear here."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#090d16]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0f172a] text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="py-3 px-4">Severity</th>
                        <th className="py-3 px-4">Finding</th>
                        <th className="py-3 px-4">Affected Employee/System</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">SLA Deadline</th>
                        <th className="py-3 px-4">Time Remaining</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-medium text-slate-300">
                      {slaFilteredAndSortedFindings.map((item, idx) => {
                        const sev = (item.severity || 'MEDIUM').toUpperCase();
                        const isResolved = item.computedUrgency === 'RESOLVED';
                        const isOverdue = item.computedIsOverdue;
                        const isEscalated = item.computedUrgency === 'ESCALATED';
                        const isDueSoon = item.computedIsDueSoon;
                        const isEscalatedLocal = !!escalatedItems[item.id];

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                            {/* Severity */}
                            <td className="py-3.5 px-4">
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wider",
                                sev === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                sev === 'HIGH' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                                sev === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                'bg-slate-800 border-slate-700 text-slate-400'
                              )}>
                                {sev}
                              </span>
                            </td>

                            {/* Finding */}
                            <td className="py-3.5 px-4 max-w-[280px]">
                              <span className="font-bold text-white block truncate">{item.rule_violated || 'Policy Violation'}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">Dept: {item.department || 'Operations'} · ID: #{item.id}</span>
                            </td>

                            {/* Affected Employee */}
                            <td className="py-3.5 px-4 font-mono text-slate-300">
                              <span className="font-semibold block text-slate-200">
                                {item.employee || item.assigned_employee_id || 'System Event'}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {item.department || 'Operations'}
                              </span>
                            </td>

                            {/* Owner */}
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-200 block">
                                Owner: {item.assigned_employee_name || 'Unassigned'}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {item.assigned_employee_id ? `ID: ${item.assigned_employee_id}` : 'Compliance Pool'}
                              </span>
                            </td>

                            {/* SLA Deadline */}
                            <td className="py-3.5 px-4 font-mono text-slate-300">
                              {item.computedDeadlineFormatted}
                            </td>

                            {/* Time Remaining */}
                            <td className="py-3.5 px-4">
                              <span className={cn(
                                "font-bold text-[11px]",
                                isOverdue ? "text-red-400" :
                                isDueSoon ? "text-amber-400" :
                                isResolved ? "text-emerald-400" :
                                isEscalated ? "text-purple-400" : "text-slate-300"
                              )}>
                                {item.computedTimeRemaining}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 text-center">
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wider",
                                isOverdue ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                isEscalated || isEscalatedLocal ? "bg-purple-500/10 border-purple-500/30 text-purple-400" :
                                isResolved ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                                isDueSoon ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                                "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                              )}>
                                {isOverdue ? 'OVERDUE' :
                                 isEscalated || isEscalatedLocal ? 'ESCALATED' :
                                 isResolved ? 'RESOLVED' :
                                 isDueSoon ? 'DUE SOON' : 'OPEN'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => setSelectedViolation(item)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-400" /> View Finding
                                </button>
                                {!isResolved && (
                                  <button 
                                    type="button"
                                    onClick={() => setConfirmEscalateItem(item)}
                                    disabled={isEscalated || isEscalatedLocal}
                                    className={cn(
                                      "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border inline-flex items-center gap-1",
                                      isEscalated || isEscalatedLocal
                                        ? "bg-slate-800/40 border-slate-700/30 text-slate-500 cursor-not-allowed"
                                        : "bg-purple-600/10 hover:bg-purple-600 border-purple-500/30 text-purple-300 hover:text-white cursor-pointer"
                                    )}
                                  >
                                    <Send className="w-3 h-3" /> {isEscalated || isEscalatedLocal ? 'Escalated' : 'Escalate'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Confirmation Dialog Modal for Escalation */}
            {confirmEscalateItem && (
              <div 
                onClick={() => setConfirmEscalateItem(null)}
                className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
              >
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-white p-6 space-y-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">Escalate this finding?</h3>
                      <p className="text-xs text-slate-400 mt-0.5">This will notify the assigned compliance owner and record the escalation event.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#090d16] rounded-2xl border border-slate-850 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Finding:</span>
                      <span className="font-bold text-white truncate max-w-[200px]">{confirmEscalateItem.rule_violated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Severity:</span>
                      <span className="font-bold text-orange-400">{confirmEscalateItem.severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Owner:</span>
                      <span className="font-bold text-slate-200">{confirmEscalateItem.assigned_employee_name || 'Unassigned'}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setConfirmEscalateItem(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-all border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmEscalation}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-purple-600/25"
                    >
                      Confirm Escalation
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SLA Compliance Disclosure */}
            <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 text-xs">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ⏱️ <strong className="text-slate-300 font-bold">Remediation Policy:</strong> SLA limits are calibrated to organizational compliance mandates. Breached items automatically escalate through designated management tiers until mitigation is confirmed.
              </p>
            </div>
          </div>
        )}

        {/* VIEW: HISTORY */}
        {activeTab === 'history' && (
          <div className="max-w-7xl mx-auto p-6 md:px-12 md:py-8 w-full animate-in fade-in zoom-in-95 duration-300">
            {/* 1. Page Heading and Organization Context */}
            <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] bg-purple-500/15 text-purple-400 font-extrabold px-2.5 py-0.5 rounded border border-purple-500/25 uppercase tracking-wider">
                    {user?.rawRole || user?.role || 'HR Compliance Officer'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Organization: <strong className="text-white font-bold">{user?.company_name || 'TechNova Technologies'}</strong>
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Audit History</h1>
                <p className="text-slate-400 mt-1.5 text-sm">Review previous compliance audits and track changes over time.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setActiveTab('new_audit'); setAuditData(null); setPolicyFiles([]); setLogFiles([]); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Start New Audit
                </button>
              </div>
            </header>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center p-16 gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-xs font-bold text-slate-400">Loading audit history...</span>
              </div>
            ) : historyError ? (
              <div className="bg-[#0f172a] border border-red-500/30 rounded-3xl p-8 text-center max-w-md mx-auto my-8 shadow-xl">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">We couldn’t load audit history.</h3>
                <p className="text-xs text-slate-400 mb-5">Please try again.</p>
                <button
                  type="button"
                  onClick={fetchHistory}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Retry
                </button>
              </div>
            ) : historyData.length === 0 ? (
              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 max-w-lg mx-auto my-8 shadow-xl">
                <History className="w-14 h-14 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No audits yet</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Run your first audit to begin tracking compliance over time.
                </p>
                <button
                  type="button"
                  onClick={() => { setActiveTab('new_audit'); setAuditData(null); setPolicyFiles([]); setLogFiles([]); }}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/25 cursor-pointer inline-flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Start New Audit
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 2. Compact Summary Section */}
                {historySummary && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Latest Score</span>
                      <div className="my-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white tracking-tight">
                          {historySummary.latestScore !== null ? historySummary.latestScore : 'Unavailable'}
                        </span>
                        {historySummary.latestScore !== null && <span className="text-xs text-slate-500 font-bold">/ 100</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Most recent audit result</span>
                    </div>

                    <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Previous Score</span>
                      <div className="my-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-slate-200 tracking-tight">
                          {historySummary.prevScore !== null ? historySummary.prevScore : 'Unavailable'}
                        </span>
                        {historySummary.prevScore !== null && <span className="text-xs text-slate-500 font-bold">/ 100</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Preceding audit run</span>
                    </div>

                    <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Score Change</span>
                      <div className="my-2">
                        {historySummary.scoreDiff !== null ? (
                          historySummary.scoreDiff > 0 ? (
                            <span className="text-2xl font-extrabold text-emerald-400 flex items-center gap-1">
                              <TrendingUp className="w-5 h-5" /> ↑ {historySummary.scoreDiff} points
                            </span>
                          ) : historySummary.scoreDiff < 0 ? (
                            <span className="text-2xl font-extrabold text-red-400 flex items-center gap-1">
                              <TrendingDown className="w-5 h-5" /> ↓ {Math.abs(historySummary.scoreDiff)} points
                            </span>
                          ) : (
                            <span className="text-2xl font-extrabold text-slate-300">
                              Stable (0 pts)
                            </span>
                          )
                        ) : (
                          <span className="text-2xl font-extrabold text-slate-400">Unavailable</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Since previous audit</span>
                    </div>

                    <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Audits</span>
                      <div className="my-2">
                        <span className="text-3xl font-extrabold text-indigo-400 tracking-tight">{historySummary.totalAudits}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Historical audit records</span>
                    </div>
                  </div>
                )}

                {/* 3. Compliance Trend Visualization */}
                {historyTrendData.length >= 2 ? (
                  <div className="bg-[#0f172a] border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-4 mb-6">
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-indigo-400" /> Compliance Trend Over Time
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Chronological score trajectory across {historyTrendData.length} audits</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Compliance Score</span>
                      </div>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="dateLabel" axisLine={{ stroke: '#334155' }} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <RechartsTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-[#090d16] border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                                    <div className="font-bold text-white">{data.fullDate}</div>
                                    <div className="text-indigo-400 font-extrabold text-sm">Score: {data.score} / 100</div>
                                    <div className="text-slate-400">Violations: {data.violationsCount}</div>
                                    <div className="text-slate-500 text-[10px] truncate max-w-[200px]">{data.policyName}</div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#6366f1" 
                            strokeWidth={3} 
                            dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#0f172a' }}
                            activeDot={{ r: 7, fill: '#a855f7', strokeWidth: 2, stroke: '#fff' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : historyData.length === 1 ? (
                  <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl flex items-center gap-3.5 text-xs text-slate-400">
                    <Info className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <div>
                      <strong className="text-white block font-semibold">Not enough audit history for a trend</strong>
                      <span className="text-slate-400 text-[11px]">Run another audit to compare compliance over time.</span>
                    </div>
                  </div>
                ) : null}

                {/* 4. Filtering Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter('ALL')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
                        historyStatusFilter === 'ALL'
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                      )}
                    >
                      All
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                        {historyFilterCounts.total}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter('COMPLIANT')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
                        historyStatusFilter === 'COMPLIANT'
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                      )}
                    >
                      Compliant
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-emerald-400">
                        {historyFilterCounts.compliant}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter('NEEDS_ATTENTION')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
                        historyStatusFilter === 'NEEDS_ATTENTION'
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                      )}
                    >
                      Needs Attention
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-amber-400">
                        {historyFilterCounts.needsAttention}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter('CRITICAL')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
                        historyStatusFilter === 'CRITICAL'
                          ? "bg-red-600 text-white shadow-sm"
                          : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                      )}
                    >
                      Critical
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-red-400">
                        {historyFilterCounts.critical}
                      </span>
                    </button>
                  </div>

                  <span className="text-xs text-slate-500 font-medium">
                    Showing {filteredHistoryData.length} of {historyData.length} audits
                  </span>
                </div>

                {/* 5. Audit History Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHistoryData.map((record, idx) => {
                    const score = record.metrics?.compliance_score ?? 0;
                    const isLatest = historyData[0]?.id === record.id || (idx === 0 && historyStatusFilter === 'ALL');
                    const violationsList = record.violations || [];
                    const totalViolations = violationsList.length;
                    const criticalCount = violationsList.filter(v => (v.severity || '').toUpperCase() === 'CRITICAL').length;
                    
                    const status = score >= 80 
                      ? { label: 'Compliant', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
                      : score >= 60 
                        ? { label: 'Needs Attention', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
                        : { label: 'Critical', colorClass: 'bg-red-500/10 text-red-400 border-red-500/30' };

                    const dateObj = record.timestamp ? new Date(record.timestamp) : new Date();
                    const formattedDate = dateObj.toLocaleDateString(undefined, { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric'
                    });

                    return (
                      <div 
                        key={record.id || idx} 
                        className={cn(
                          "bg-[#0f172a] rounded-3xl border p-6 shadow-xl transition-all flex flex-col justify-between space-y-5 group",
                          isLatest 
                            ? "border-indigo-500/60 ring-1 ring-indigo-500/30" 
                            : "border-slate-800 hover:border-slate-700"
                        )}
                      >
                        <div className="space-y-4">
                          {/* Card Header */}
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>{formattedDate}</span>
                            </div>
                            {isLatest && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 tracking-wider">
                                Latest Audit
                              </span>
                            )}
                          </div>

                          {/* Score and Connected Status */}
                          <div className="bg-[#090d16] p-4 rounded-2xl border border-slate-850 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block">Compliance Score</span>
                              <div className="text-3xl font-extrabold text-white mt-1 flex items-baseline gap-1">
                                {score}
                                <span className="text-xs text-slate-500 font-bold">/ 100</span>
                              </div>
                            </div>
                            <span className={cn("px-3 py-1 rounded-full text-xs font-extrabold border uppercase tracking-wide", status.colorClass)}>
                              {status.label}
                            </span>
                          </div>

                          {/* Policy and Logs file */}
                          <div className="space-y-2 text-xs">
                            <div className="bg-[#090d16] px-3 py-2 rounded-xl border border-slate-850 flex items-center gap-2 truncate">
                              <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                              <span className="text-slate-300 truncate font-medium">{record.policy_filename || 'Company Policy Document'}</span>
                            </div>
                            <div className="bg-[#090d16] px-3 py-2 rounded-xl border border-slate-850 flex items-center gap-2 truncate">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              <span className="text-slate-300 truncate font-medium">{record.log_filename || 'System Activity Logs'}</span>
                            </div>
                          </div>

                          {/* Finding Counters */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-850">
                            <span className="text-slate-400 font-medium">{totalViolations} violations</span>
                            <span className={cn(
                              "font-bold",
                              criticalCount > 0 ? "text-red-400" : "text-slate-500"
                            )}>
                              {criticalCount} critical finding{criticalCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        {/* Primary View Report Action */}
                        <button 
                          type="button"
                          onClick={() => viewHistoricalReport(record)}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex justify-center items-center gap-2 transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                        >
                          View Report <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: REPORT DASHBOARD FALLBACK */}
        {activeTab === 'report' && !auditData && (
          <div className="bg-[#0b0f19] text-slate-100 flex-1 w-full pt-16 pb-24">
            <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">No Active Audit Report Selected</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Run a new audit scan or load the pre-configured demo audit data to inspect executive metrics and risk reports.
              </p>
              <div className="flex justify-center gap-4 pt-2">
                <button
                  onClick={loadDemoData}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Load Demo Audit Data
                </button>
                <button
                  onClick={() => setActiveTab('new_audit')}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Run New Audit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: REPORT DASHBOARD */}
        {activeTab === 'report' && auditData && (
          <div className="bg-[#0b0f19] text-slate-100 flex-1 w-full pt-8 pb-24 animate-in slide-in-from-bottom-8 duration-500" id="report-container">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
              
              {/* 1. Page Title and Organization Context */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 no-print border-b border-slate-800 pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="text-slate-400 hover:text-indigo-400 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors mr-3"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to History
                    </button>
                    <span className="text-[10px] bg-purple-500/15 text-purple-400 font-extrabold px-2.5 py-0.5 rounded border border-purple-500/25 uppercase tracking-wider">
                      {user?.rawRole || user?.role || 'HR Compliance Officer'}
                    </span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Compliance Overview</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400 font-medium">
                    <span className="text-slate-100 font-bold">{user?.company_name || 'TechNova Technologies'}</span>
                    <span className="text-slate-600">•</span>
                    <span>Last audit: {auditData.timestamp ? new Date(auditData.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today'}</span>
                    {auditData.policy_filename && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-indigo-400" /> {auditData.policy_filename}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 no-print flex-wrap">
                  <button
                    onClick={exportPDF}
                    disabled={pdfGenerating}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {pdfGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
                    ) : (
                      <><Download className="w-4 h-4" /> Export PDF Report</>
                    )}
                  </button>
                  <button
                    onClick={exportCSV}
                    disabled={csvExporting}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    {csvExporting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
                    ) : (
                      <><FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export CSV</>
                    )}
                  </button>
                </div>
              </div>

              {pdfError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl font-bold">
                  {pdfError}
                </div>
              )}

              {violationsError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center justify-between gap-4 font-bold">
                  <div>
                    <h4 className="text-white text-sm font-bold">We couldn’t load the compliance overview.</h4>
                    <p className="text-slate-400 text-xs font-normal mt-0.5">{violationsError}</p>
                  </div>
                  <button
                    onClick={fetchViolations}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* 2 & 3. Overall Compliance Summary & Score-change Explanation */}
              <div className="mb-8 bg-[#0f172a] text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Big Score Focal Point */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center text-center bg-[#090d16] border border-slate-850 p-6 md:p-8 rounded-2xl">
                    <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold">Current Compliance Score</span>
                    <div className="text-6xl md:text-7xl font-extrabold text-white my-3 tracking-tight flex items-baseline gap-1.5">
                      {currentScore}
                      <span className="text-xl md:text-2xl text-slate-500 font-bold">/ 100</span>
                    </div>
                    
                    {/* Compliance Status Badge */}
                    <span className={cn("px-4 py-1.5 rounded-full text-xs font-extrabold border tracking-wider uppercase", scoreStatus.colorClass)}>
                      {scoreStatus.label}
                    </span>

                    {/* Score Change from Previous Audit */}
                    <div className="mt-4 pt-4 border-t border-slate-800/80 w-full flex items-center justify-center gap-2 text-xs font-bold">
                      {scoreDiff > 0 ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" /> ↑ {scoreDiff} points from previous audit
                        </span>
                      ) : scoreDiff < 0 ? (
                        <span className="text-red-400 flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" /> ↓ {Math.abs(scoreDiff)} points from previous audit
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <Info className="w-4 h-4" /> Stable score from previous audit
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score Driver & Recommended Action */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-[#090d16] border border-slate-850 p-5 rounded-2xl space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                        Main Driver:
                      </span>
                      <p className="text-sm font-bold text-slate-100 leading-relaxed">
                        {mainDriverText}
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Evaluated across company audit logs against defined corporate policies. Priority findings below require prompt acknowledgment and resolution.
                      </p>
                    </div>

                    <div className="bg-[#090d16] border border-slate-850 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                          Recommended Action:
                        </span>
                        <p className="text-xs font-semibold text-slate-200 mt-1 leading-relaxed">
                          {primaryRecommendationText}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const el = document.getElementById('priority-findings-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 flex-shrink-0"
                      >
                        Review Findings <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Supporting Metric Cards (4 Cards) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">New Violations</span>
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold text-white tracking-tight">{violations.length}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Logged in current audit</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-red-500/30 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Critical Findings</span>
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold text-red-400 tracking-tight">{criticalFindingsCount}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Critical/High severity</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-amber-500/30 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Pending Actions</span>
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{pendingActionsCount}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Awaiting mitigation response</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-purple-500/30 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Open Escalations</span>
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Send className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold text-purple-400 tracking-tight">{openEscalationsCount}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Department leads notified</span>
                </div>
              </div>

              {/* 5. Compliance Breakdown & Department Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Compliance Breakdown</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Category compliance based on policy evaluation and activity logs</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {domainScores.map((domain, idx) => (
                      <div key={idx} className="bg-[#090d16] p-4 rounded-2xl border border-slate-850 space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-slate-200 font-bold">{domain.name}</span>
                          <span className={cn(
                            "font-extrabold text-sm",
                            domain.score >= 80 ? "text-emerald-400" : domain.score >= 60 ? "text-amber-400" : "text-red-400"
                          )}>
                            {domain.score}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800" role="progressbar" aria-valuenow={domain.score} aria-valuemin="0" aria-valuemax="100" aria-label={domain.name}>
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              domain.score >= 80 ? "bg-emerald-500" : domain.score >= 60 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${domain.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[#0f172a] border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">Violations by Department</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Distribution across business units</p>
                      </div>
                    </div>
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="name" axisLine={{ stroke: '#334155' }} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 'dataMax + 2']} />
                          <RechartsTooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                          <Bar dataKey="violations" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  <div className="bg-[#090d16] p-3.5 rounded-2xl border border-slate-850 flex items-center justify-between text-xs text-slate-400 mt-4">
                    <span>Highest exposure:</span>
                    <span className="text-indigo-400 font-bold">{topDepartmentsList[0] ? `${topDepartmentsList[0][0]} (${topDepartmentsList[0][1]} flags)` : 'None'}</span>
                  </div>
                </div>
              </div>

              {/* 6. Priority Findings Section */}
              <div id="priority-findings-section" className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-indigo-400" /> Priority Findings
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">High-priority compliance items requiring HR review and remediation</p>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">{priorityFindings.length} priority items</span>
                </div>

                {priorityFindings.length === 0 ? (
                  <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white">No active findings</h3>
                    <p className="text-xs text-slate-400 mt-1">Your current audit has no unresolved compliance findings.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {priorityFindings.map((finding, idx) => {
                      const sev = (finding.severity || 'HIGH').toUpperCase();
                      const sevLabel = sev === 'CRITICAL' ? 'CRITICAL RISK' : sev === 'HIGH' ? 'HIGH RISK' : 'MEDIUM RISK';
                      const sevColor = sev === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 text-red-400' : sev === 'HIGH' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400';

                      return (
                        <div key={finding.id || idx} className="bg-[#0f172a] border border-slate-800 hover:border-indigo-500/40 p-6 rounded-3xl shadow-xl flex flex-col justify-between transition-all space-y-4">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-3">
                              <span className={cn("px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase border tracking-wider", sevColor)}>
                                {sevLabel}
                              </span>
                              <span className="text-xs text-slate-500 font-mono">Finding #{finding.id || idx + 1}</span>
                            </div>

                            <h4 className="text-base font-bold text-white tracking-tight leading-snug mb-3">
                              {finding.rule_violated || 'Compliance Requirement Deviation'}
                            </h4>

                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-[#090d16] p-3 rounded-2xl border border-slate-850 mb-3 font-medium">
                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-bold">Employee</span>
                                <span className="font-semibold text-slate-200">{finding.employee || 'Unknown'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-bold">Department</span>
                                <span className="font-semibold text-slate-200">{finding.department || 'Operations'}</span>
                              </div>
                              <div className="col-span-2 border-t border-slate-900 pt-1.5 mt-1">
                                <span className="text-[10px] text-slate-500 block uppercase font-bold">Policy</span>
                                <span className="font-semibold text-indigo-300 truncate block">{finding.rule_violated || 'Corporate Governance'}</span>
                              </div>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Why this matters:</span>
                                <p className="text-slate-300 mt-0.5 leading-relaxed">{finding.explanation || 'Activity deviated from documented access control standards.'}</p>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider block">Recommended action:</span>
                                <p className="text-indigo-200 mt-0.5 leading-relaxed font-semibold">{finding.recommendation || 'Initiate standard remediation and update training credentials.'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedEvidenceViolation(finding)}
                              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-400" /> View Evidence
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedViolation(finding);
                                }}
                                className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Send className="w-3.5 h-3.5" /> Escalate
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedViolation(finding);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 7. Comprehensive Violations Explorer & Registry */}
              <div className="mt-8 bg-[#0f172a] p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl" id="violations-registry-section">
                <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <AlertTriangle className="text-amber-500 w-5 h-5" /> Violations Explorer & Ledger
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5 font-medium">Showing {sortedViolations.length} of {violations.length} logged flags.</p>
                  </div>
                  
                  {/* Filters Toolbar */}
                  <div className="flex flex-wrap items-center gap-3 no-print">
                    {/* Search */}
                    <div className="relative flex-grow sm:flex-grow-0">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input 
                        type="text" 
                        placeholder="Search employee, rules, log..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold" 
                      />
                    </div>
                    
                    {/* Department Dropdown */}
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-300"
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
                      className="bg-slate-900 border border-slate-700 rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-300"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="PENDING_VERIFICATION">Pending Verification</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="REQUIRES_CHANGES">Requires Changes</option>
                      <option value="REOPENED">Reopened</option>
                    </select>

                    {/* SLA Status Filter */}
                    <select
                      value={filterSlaState}
                      onChange={(e) => setFilterSlaState(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-300"
                    >
                      <option value="ALL">All SLA Statuses</option>
                      <option value="ON_TRACK">On Track</option>
                      <option value="NEAR_BREACH">Near Breach</option>
                      <option value="BREACHED">Breached</option>
                      <option value="ESCALATED">Escalated</option>
                    </select>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2">
                      <select
                        value={sortByField}
                        onChange={(e) => setSortByField(e.target.value)}
                        className="bg-transparent border-0 text-xs py-2 pr-2 outline-none cursor-pointer focus:ring-0 font-semibold text-slate-300"
                      >
                        <option value="severity" className="bg-slate-900 text-white">Sort: Severity</option>
                        <option value="status" className="bg-slate-900 text-white">Sort: Status</option>
                        <option value="employee" className="bg-slate-900 text-white">Sort: Employee</option>
                        <option value="department" className="bg-slate-900 text-white">Sort: Department</option>
                      </select>
                      <button 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 cursor-pointer"
                        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
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
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            {level}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                              isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Table */}
                    {sortedViolations.length === 0 ? (
                      <div className="p-12 bg-slate-900/50 border border-slate-800 rounded-2xl text-center text-slate-400 font-medium">
                        No policy violations matching current filters.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-sm">
                        <table className="w-full text-left border-collapse text-xs text-slate-300">
                          <thead>
                            <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-extrabold uppercase text-[10px] tracking-wider">
                              <th className="p-3.5 w-24">Employee</th>
                              <th className="p-3.5 w-28">Department</th>
                              <th className="p-3.5">Rule Violated</th>
                              <th className="p-3.5 w-24 text-center">Severity</th>
                              <th className="p-3.5 w-28 text-center">Status</th>
                              <th className="p-3.5 w-32 text-center">SLA Status</th>
                              <th className="p-3.5 w-28 text-center no-print">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {violationsToRender.map((v, i) => {
                              const sev = (v.severity || 'LOW').toUpperCase();
                              const sevBadges = {
                                CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
                                HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
                                MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                                LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              };

                              const stat = (v.status || 'OPEN').toUpperCase();
                              const statusBadges = {
                                OPEN: 'bg-red-500/15 text-red-400 border-red-500/30',
                                IN_PROGRESS: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                                PENDING_VERIFICATION: 'bg-orange-500/15 text-orange-400 border-orange-500/30 animate-pulse',
                                RESOLVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                                REQUIRES_CHANGES: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                                REOPENED: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              };

                              return (
                                <tr key={v.id || i} className="hover:bg-slate-900/60 transition-colors">
                                  <td className="p-3.5 font-bold text-slate-100">{v.employee || 'Unknown'}</td>
                                  <td className="p-3.5 font-medium text-slate-400">{v.department || 'Unknown'}</td>
                                  <td className="p-3.5">
                                    <div className="font-semibold text-white">{v.rule_violated}</div>
                                    <div className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{v.explanation}</div>
                                    {v.sla && ['CRITICAL', 'HIGH'].includes(sev) && (
                                      <div className="max-w-xs mt-1.5 no-print">
                                        <SLAStatusIndicator sla={v.sla} severity={v.severity} />
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                      sevBadges[sev] || 'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}>
                                      {sev}
                                    </span>
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border uppercase ${
                                      statusBadges[stat] || 'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}>
                                      {stat.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="p-3.5 text-center">
                                    {renderSlaBadge(v.sla)}
                                  </td>
                                  <td className="p-3.5 text-center no-print">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => setSelectedEvidenceViolation(v)}
                                        className="text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                        title="View Evidence"
                                      >
                                        Evidence
                                      </button>
                                      <button
                                        onClick={() => setSelectedViolation(v)}
                                        className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                      >
                                        Manage
                                      </button>
                                      {isHR && (
                                        <button
                                          onClick={() => setSelectedNotifyViolationId(v.id)}
                                          className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                          title="Notify Assigned Employee"
                                        >
                                          <Send className="w-3 h-3 text-indigo-200" /> Notify
                                        </button>
                                      )}
                                    </div>
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
                        className="w-full mt-4 py-3 bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer text-center no-print shadow-md"
                      >
                        Load More Violations (+10)
                      </button>
                    )}
                  </div>

                  {/* Right Column: Frequent Policy Breaches */}
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

      {/* POLICY ACKNOWLEDGMENT DETAIL MODAL */}
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
                  <Lock className="w-4 h-4 text-indigo-400" /> Acknowledgment Details
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Recorded employee policy acknowledgment metadata</p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedAckForView(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingAckDetail ? (
              <div className="p-12 flex flex-col justify-center items-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400 font-semibold">Loading acknowledgment details...</span>
              </div>
            ) : ackViewDetail ? (
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                
                {/* Employee & Dept Info */}
                <div className="grid grid-cols-2 gap-4 bg-[#090d16] p-4 rounded-2xl border border-slate-850">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Employee</span>
                    <span className="text-xs font-bold text-white mt-1 block">{ackViewDetail.employee_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">ID: {ackViewDetail.employee_id}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Department</span>
                    <span className="text-xs font-bold text-white mt-1 block">{ackViewDetail.department || 'IT Operations'}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">{ackViewDetail.employee_email}</span>
                  </div>
                </div>

                {/* Policy details */}
                <div className="p-4 rounded-2xl bg-[#090d16] border border-slate-850 space-y-2">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">Policy Reference</span>
                    <span className="text-xs font-bold text-indigo-400 mt-1 block">
                      {ackViewDetail.policy_title || 'Corporate Compliance Agreement'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-400 pt-1.5 border-t border-slate-850">
                    <div>Version: <span className="text-slate-200 font-bold">{ackViewDetail.policy_version || 'v1.0'}</span></div>
                    <div>Status: <span className={cn(
                      "font-bold uppercase",
                      ackViewDetail.status === 'SIGNED' || ackViewDetail.status === 'ACKNOWLEDGED' ? "text-emerald-400" : ackViewDetail.status === 'OVERDUE' ? "text-red-400" : "text-amber-400"
                    )}>{ackViewDetail.status === 'SIGNED' || ackViewDetail.status === 'ACKNOWLEDGED' ? 'Acknowledged' : ackViewDetail.status}</span></div>
                  </div>
                </div>

                {/* Acknowledgment details */}
                <div className="p-4 rounded-2xl bg-[#090d16] border border-slate-850 space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-slate-400">Acknowledgment Date:</span>
                    <span className="font-bold text-white font-mono">{ackViewDetail.signed_at ? new Date(ackViewDetail.signed_at).toLocaleString() : 'Unavailable'}</span>
                  </div>
                  {ackViewDetail.acknowledgment_id && (
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">Acknowledgment ID:</span>
                      <span className="font-bold text-slate-300 font-mono">{ackViewDetail.acknowledgment_id}</span>
                    </div>
                  )}
                  {ackViewDetail.signed_ip_address && (
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">Signing IP Source:</span>
                      <span className="font-bold text-white font-mono">{ackViewDetail.signed_ip_address}</span>
                    </div>
                  )}
                  {ackViewDetail.authentication_method && (
                    <div className="flex justify-between border-b border-slate-850 pb-1.5">
                      <span className="text-slate-400">Signing Method:</span>
                      <span className="font-bold text-slate-300">{ackViewDetail.authentication_method}</span>
                    </div>
                  )}
                </div>

                {/* SHA & receipt hashes if available */}
                {(ackViewDetail.policy_document_sha256 || ackViewDetail.receipt_hash) && (
                  <div className="p-4 rounded-2xl bg-[#090d16] border border-slate-850 text-[10px] space-y-2 font-mono">
                    {ackViewDetail.policy_document_sha256 && (
                      <div>
                        <span className="block text-[8px] uppercase font-bold text-slate-500">Policy Document SHA-256</span>
                        <span className="text-slate-400 break-all select-all block mt-0.5">{ackViewDetail.policy_document_sha256}</span>
                      </div>
                    )}
                    {ackViewDetail.receipt_hash && (
                      <div className="border-t border-slate-850 pt-2">
                        <span className="block text-[8px] uppercase font-bold text-slate-500">Audit Ledger Receipt Hash</span>
                        <span className="text-emerald-400 break-all select-all font-bold block mt-0.5">{ackViewDetail.receipt_hash}</span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs italic">
                Failed to populate acknowledgment detail metrics.
              </div>
            )}

            <div className="p-4 bg-slate-900 border-t border-slate-850 flex justify-end">
              <button 
                type="button"
                onClick={() => setSelectedAckForView(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition-all border border-slate-700"
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

      {/* Evidence Modal */}
      {selectedEvidenceViolation && (
        <EvidenceModal
          violation={selectedEvidenceViolation}
          onClose={() => setSelectedEvidenceViolation(null)}
          onMarkResolved={(v) => {
            setSelectedViolation(v);
            setSelectedEvidenceViolation(null);
          }}
          onEscalate={(v) => {
            setSelectedViolation(v);
            setSelectedEvidenceViolation(null);
          }}
        />
      )}

      {/* User Invitation Modal */}
      {showInviteModal && (
        <UserInvitationModal user={user} onClose={() => setShowInviteModal(false)} />
      )}

      {/* Employee Notification Modal */}
      {selectedNotifyViolationId && (
        <EmployeeNotificationModal
          violationId={selectedNotifyViolationId}
          user={user}
          onClose={() => setSelectedNotifyViolationId(null)}
          onSuccess={(msg) => {
            setNotificationToastMsg(msg);
            fetchViolations();
            setTimeout(() => setNotificationToastMsg(''), 6000);
          }}
        />
      )}

      {/* In-App Notification Toast */}
      {notificationToastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-[#090d16] border border-indigo-500/40 text-white rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{notificationToastMsg}</span>
          <button 
            type="button"
            onClick={() => setNotificationToastMsg('')}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}