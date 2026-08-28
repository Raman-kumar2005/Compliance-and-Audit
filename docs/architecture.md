# AI Auditor — Technical Architecture & System Design

AI Auditor is a multi-tenant, AI-powered compliance platform built with FastAPI, Python, React, and Google Gemini LLM API.

---

## 🏗️ High-Level System Architecture Diagram

```text
+-----------------------------------------------------------------------+
|                         React Frontend Client                          |
|             (Vite + React 19 + Tailwind CSS + Lucide Icons)           |
+-----------------------------------------------------------------------+
        |                                                       ^
        | REST API (Axios / Bearer JWT)                         | JSON Responses
        v                                                       |
+-----------------------------------------------------------------------+
|                         FastAPI Backend Server                        |
|                    (Python 3.13 + Uvicorn + PyPDF)                    |
|                                                                       |
|  +-------------------+   +--------------------+   +----------------+  |
|  | JWT Auth Guard    |   | Multi-Tenant Router|   | SLA Engine     |  |
|  +-------------------+   +--------------------+   +----------------+  |
+-----------------------------------------------------------------------+
        |                                                       |
        | Document & Log Text                                   | Tenant File Ledger
        v                                                       v
+-----------------------+                       +-----------------------+
|  Google Gemini API    |                       | File-Based JSON DB    |
| (gemini-2.5-flash)    |                       | history_<tenant>.json |
| Structured Violation  |                       | policies_<tenant>.json|
| Extraction Pipeline   |                       | ack_<tenant>.json     |
+-----------------------+                       +-----------------------+
```

---

## 🧩 Core System Modules

### 1. Document Extraction & Token Limit Layer
- **Policy Reader**: Extracts text from corporate PDF policy documents using `pypdf` (`PdfReader`) or raw UTF-8 `.txt` files.
- **System Log Sampler**: Parses CSV system logs via `pandas` dataframes and sample rows, or processes `.json`/`.txt` logs.
- **Token Truncator**: Enforces extraction bounds (`MAX_EXTRACT_PER_POLICY = 10000` chars, `MAX_EXTRACT_PER_LOG = 15000` chars) to ensure input fits comfortably within LLM context windows.

### 2. LLM Audit Pipeline (`google-genai`)
- Constructs a strict system prompt instructing `gemini-2.5-flash` to analyze extracted log records against corporate policy clauses.
- Demands structured JSON output adhering to a strict schema containing:
  - `rule_violated`: Specific policy section breached.
  - `severity`: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
  - `explanation`: Detailed reasoning citing evidence.
  - `log_entry`: The specific log record snippet flagged.
  - `recommendation`: Actionable remediation step.
- Computes overall compliance score:
  $$\text{Compliance Score} = 100 - \sum \text{Severity Weights}$$

### 3. Multi-Tenant Data Isolation
- Uses `get_tenant_file(base_name, tenant_id)` to dynamically scope JSON data stores per tenant.
- Scoped JSON files include:
  - `history_<tenant_id>.json`: Audit run history and findings.
  - `policies_<tenant_id>.json`: Active policy documents.
  - `acknowledgments_<tenant_id>.json`: Signed policy pledges.
  - `activity_<tenant_id>.json`: Auditable remediation log.
  - `employee_notifications_<tenant_id>.json`: Notification delivery log.
- Endpoint isolation verified by 17 automated tests in `backend/test_isolation.py`.

### 4. Defensible E-Signature & Receipt Ledger
- Validates employee typed legal signature against registered profile name.
- Computes SHA-256 document checksum.
- Generates a tamper-evident receipt hash:
  $$\text{Receipt Hash} = \text{SHA256}(\text{ack\_id} \mid \text{emp\_id} \mid \text{policy\_id} \mid \text{version} \mid \text{timestamp} \mid \text{ip})$$
- Generates client-side PDF receipts via `html2pdf.js`.

### 5. SLA Monitoring & Escalation Engine
- Evaluates resolution deadlines based on configurable SLA rules per severity level.
- Computes real-time SLA statuses: `ON_TRACK`, `WARNING_50`, `WARNING_80`, `ACKNOWLEDGMENT_OVERDUE`, `BREACHED`, `ESCALATED`, `PAUSED`, `RESOLVED`.
- Supports manual escalation routing to department leads and SLA pause/resume controls.

### 6. HR-Controlled Employee Notification Workflow
- Disables automatic emails upon AI detection to require manual HR confirmation.
- Resolves employee work email from active tenant directory (`USERS_DB` / `MOCK_EMPLOYEES`).
- Enforces email masking (`a***v@technova-demo.com`) and neutral text without raw evidence.
- Environment-driven SMTP: Dispatches via TLS `smtplib` if `SMTP_HOST` env vars are configured; falls back to recording an auditable demo event if unconfigured.
- Enforces a 5-minute cooldown per violation+employee.
