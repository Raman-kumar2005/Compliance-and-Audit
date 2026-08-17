import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function PrintableAuditReport({ auditData }) {
  if (!auditData) return null;

  const metrics = auditData.metrics || {};
  const violations = auditData.violations || [];
  const topFiveViolations = violations.slice(0, 5);

  const barData = Object.entries(metrics.violations_by_department || {}).map(([key, val]) => ({
    name: key,
    violations: val
  }));

  const formattedDate = auditData.timestamp 
    ? new Date(auditData.timestamp).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div 
      id="printable-audit-report" 
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '0px',
        width: '800px',
        padding: '40px',
        backgroundColor: '#ffffff',
        color: '#1e293b',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
      className="print-report shadow-2xl rounded-lg"
    >
      {/* Header */}
      <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a8a', margin: '0 0 5px 0' }}>
              Enterprise Compliance Audit Report
            </h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0' }}>
              ID: {auditData.id || 'Demo Preview'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 5px 0' }}>
              Generated: <strong>{formattedDate}</strong>
            </p>
            <span style={{ 
              fontSize: '10px', 
              backgroundColor: '#eff6ff', 
              color: '#1e90ff', 
              padding: '4px 8px', 
              borderRadius: '9999px', 
              fontWeight: '700',
              border: '1px solid #dbeafe'
            }}>
              CONFIDENTIAL
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', backgroundColor: '#f8fafc' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#475569', margin: '0 0 10px 0' }}>
            Compliance Overview
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '48px', fontWeight: '900', color: metrics.compliance_score >= 80 ? '#10b981' : '#ef4444' }}>
              {metrics.compliance_score}%
            </span>
            <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>
              Score
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#475569', marginTop: '10px', lineHeight: '1.5' }}>
            The automated audit scan detected {violations.length} total policy deviations. 
            Overall system health is rated as <strong>{metrics.compliance_score >= 80 ? 'SATISFACTORY' : 'REQUIRES ATTENTION'}</strong>.
          </p>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', backgroundColor: '#f8fafc' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#475569', margin: '0 0 10px 0' }}>
            Threat Severity Distribution
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center', marginTop: '15px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '10px', color: '#065f46', fontWeight: '600' }}>Low</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>{metrics.risk_distribution?.Low || 0}</div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '10px', color: '#92400e', fontWeight: '600' }}>Medium</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#d97706' }}>{metrics.risk_distribution?.Medium || 0}</div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '10px', color: '#9a3412', fontWeight: '600' }}>High</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#ea580c' }}>{metrics.risk_distribution?.High || 0}</div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: '600' }}>Critical</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#dc2626' }}>{metrics.risk_distribution?.Critical || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Row */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginBottom: '15px' }}>
          Violations by Inferred Department
        </h2>
        <div style={{ width: '100%', height: '160px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
              <Bar dataKey="violations" fill="#4f46e5" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 5 Violations Table */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginBottom: '15px' }}>
          Top 5 Compliance Breaches / Anomalies
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700' }}>ID</th>
              <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700' }}>Employee / Dept</th>
              <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700' }}>Rule Violated</th>
              <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700', textAlign: 'center' }}>Severity</th>
              <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700' }}>Inference / Evidence</th>
            </tr>
          </thead>
          <tbody>
            {topFiveViolations.map((v, i) => {
              const sev = (v.severity || 'Medium').toUpperCase();
              const badgeColors = 
                sev === 'CRITICAL' ? { bg: '#fef2f2', border: '#fecaca', text: '#ef4444' } :
                sev === 'HIGH' ? { bg: '#fff7ed', border: '#fed7aa', text: '#f97316' } :
                sev === 'MEDIUM' ? { bg: '#fffbeb', border: '#fde68a', text: '#d97706' } :
                { bg: '#ecfdf5', border: '#a7f3d0', text: '#10b981' };

              return (
                <tr key={v.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b' }}>{v.id || (i + 1)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: '600', color: '#334155' }}>E-{v.employee || 'Unknown'}</div>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>{v.department || 'Unknown'}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1e293b', maxWidth: '180px', wordBreak: 'break-word' }}>
                    {v.rule_violated}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      backgroundColor: badgeColors.bg,
                      color: badgeColors.text,
                      border: `1px solid ${badgeColors.border}`,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: '700'
                    }}>
                      {sev}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569', maxWidth: '220px', wordBreak: 'break-word' }}>
                    {v.explanation}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Top 5 Recommendations */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginBottom: '15px' }}>
          Audit Recommendations & Mitigation Strategy
        </h2>
        <ul style={{ paddingLeft: '20px', margin: '0', fontSize: '11px', lineHeight: '1.6', color: '#475569' }}>
          {topFiveViolations.map((v, i) => (
            <li key={i} style={{ marginBottom: '8px' }}>
              <strong>E-{v.employee || 'Unknown'} ({v.department}):</strong> {v.recommendation || 'No specific action logged.'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
