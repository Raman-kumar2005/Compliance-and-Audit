import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';

export default function SLAStatusIndicator({ sla, severity }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!sla) return;
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, [sla]);

  const metrics = useMemo(() => {
    if (!sla) {
      return {
        status: 'ON_TRACK',
        percent: 0,
        colorClass: '',
        textClass: '',
        progressColor: '',
        statusLabel: '',
        timeLabel: '',
        ackLabel: '',
        resDueLocal: 'N/A'
      };
    }

    const status = sla.sla_status || 'ON_TRACK';
    const percent = sla.sla_percent_elapsed || 0;
    const isPaused = status === 'PAUSED';
    const isResolved = status === 'RESOLVED';
    
    // Parse deadlines
    let resDue = null;
    if (sla.resolution_due_at) {
      try {
        const cleaned = sla.resolution_due_at.endsWith('Z') ? sla.resolution_due_at : sla.resolution_due_at + 'Z';
        resDue = new Date(cleaned);
      } catch (e) {
        console.error(e);
      }
    }

    let ackDue = null;
    if (sla.acknowledgment_due_at) {
      try {
        const cleaned = sla.acknowledgment_due_at.endsWith('Z') ? sla.acknowledgment_due_at : sla.acknowledgment_due_at + 'Z';
        ackDue = new Date(cleaned);
      } catch (e) {
        console.error(e);
      }
    }

    // Determine color schemes
    let colorClass = 'bg-emerald-500';
    let textClass = 'text-emerald-450 border-emerald-500/20 bg-emerald-500/10';
    let progressColor = 'bg-emerald-500';
    let statusLabel = 'On track';

    if (sla.escalation_level > 0 || status === 'ESCALATED') {
      colorClass = 'bg-purple-600';
      textClass = 'text-purple-400 border-purple-500/25 bg-purple-500/10';
      progressColor = 'bg-purple-600';
      statusLabel = `Escalated to Level ${sla.escalation_level}`;
    } else if (status === 'BREACHED' || status === 'ACKNOWLEDGMENT_OVERDUE') {
      colorClass = 'bg-red-500';
      textClass = 'text-red-400 border-red-500/20 bg-red-500/10';
      progressColor = 'bg-red-500';
      statusLabel = status === 'ACKNOWLEDGMENT_OVERDUE' ? 'Ack Overdue' : 'SLA Breached';
    } else if (percent >= 80) {
      colorClass = 'bg-orange-500';
      textClass = 'text-orange-400 border-orange-500/20 bg-orange-500/10';
      progressColor = 'bg-orange-500';
      statusLabel = 'Warning';
    } else if (percent >= 50) {
      colorClass = 'bg-amber-500';
      textClass = 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      progressColor = 'bg-amber-500';
      statusLabel = 'Warning';
    }

    if (isPaused) {
      colorClass = 'bg-blue-500';
      textClass = 'text-blue-400 border-blue-500/20 bg-blue-500/10';
      progressColor = 'bg-blue-500';
      statusLabel = 'SLA Paused';
    }

    if (isResolved) {
      colorClass = 'bg-emerald-600';
      textClass = 'text-emerald-450 border-emerald-500/20 bg-emerald-500/10';
      progressColor = 'bg-emerald-600';
      statusLabel = 'Resolved';
    }

    // Countdown formatting
    let timeLabel = '';
    if (isResolved) {
      timeLabel = 'Resolved';
    } else if (isPaused) {
      timeLabel = 'Paused';
    } else if (resDue) {
      const diffMs = resDue.getTime() - now.getTime();
      if (diffMs <= 0) {
        timeLabel = 'Breached';
      } else {
        const hrs = Math.floor(diffMs / (3600 * 1000));
        const remMins = Math.floor((diffMs % (3600 * 1000)) / 60000);
        
        if (hrs > 24) {
          const days = Math.floor(hrs / 24);
          const remHrs = hrs % 24;
          timeLabel = `${days}d ${remHrs}h remaining`;
        } else if (hrs > 0) {
          timeLabel = `${hrs}h ${remMins}m remaining`;
        } else {
          timeLabel = `${remMins}m remaining`;
        }
      }
    }

    // Acknowledge deadline warning countdown
    let ackLabel = '';
    if (!sla.acknowledged_at && ackDue && !isResolved && !isPaused) {
      const diffMs = ackDue.getTime() - now.getTime();
      if (diffMs > 0) {
        const hrs = Math.floor(diffMs / (3600 * 1000));
        const remMins = Math.floor((diffMs % (3600 * 1000)) / 60000);
        ackLabel = `Ack due in ${hrs > 0 ? `${hrs}h ` : ''}${remMins}m`;
      } else {
        ackLabel = 'Acknowledgment Overdue';
      }
    }

    return {
      status,
      percent,
      colorClass,
      textClass,
      progressColor,
      statusLabel,
      timeLabel,
      ackLabel,
      resDueLocal: resDue ? resDue.toLocaleString() : 'N/A'
    };
  }, [sla, now]);

  if (!sla) return null;

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-2 mt-2">
      <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider">
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          SLA Deadline: <span className="text-slate-200 normal-case font-mono">{metrics.resDueLocal}</span>
        </span>
        <span className={`px-2 py-0.5 rounded border ${metrics.textClass}`}>
          {metrics.statusLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${metrics.progressColor}`}
          style={{ width: `${metrics.percent}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
        <span>{metrics.percent}% elapsed</span>
        <span className="text-slate-300 flex items-center gap-1 font-mono">
          {metrics.ackLabel && (
            <span className="text-amber-500 mr-2 border border-amber-500/10 bg-amber-500/5 px-1.5 py-0.2 rounded font-sans uppercase text-[8px] tracking-wide animate-pulse">
              {metrics.ackLabel}
            </span>
          )}
          {metrics.timeLabel}
        </span>
      </div>
    </div>
  );
}
