# AI Auditor — Resume & Portfolio Showcase Guide

Copy-paste-ready project descriptions, LinkedIn summary, and resume bullet points tailored for technical job applications.

---

## 📌 1-Line Resume Summary

> Built **AI Auditor**, an AI-powered HR compliance and risk-management platform that analyzes company policies and system logs, identifies potential violations using Google Gemini LLM API, tracks defensible policy E-signatures, and automates SLA escalation workflows.

---

## 💼 LinkedIn / Portfolio Overview (2-Line Summary)

> **AI Auditor** is a multi-tenant HR compliance and risk platform built with FastAPI, React, and Google Gemini API. It automates policy violation detection across system logs, computes risk metrics, manages SLA escalations, and provides defensible policy electronic signature tracking.

---

## 📝 Verified Resume Bullet Points

- **AI Violation Detection & Risk Assessment**: Architected an AI audit pipeline integrating FastAPI and Google Gemini API (`gemini-2.5-flash`) to parse PDF policy documents and system CSV/JSON logs, automatically identifying policy violations with structured evidence explanations and risk scores.
- **Defensible E-Signature & Multi-Tenant Security**: Developed a defensible electronic signature engine with SHA-256 document hashing, tamper-evident receipt generation, and IP masking, supported by a multi-tenant file-based JSON database ledger verified across 17 unit tests.
- **SLA Escalation & HR Notification Engine**: Implemented an automated SLA lifecycle monitor with custom thresholds (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), pause/resume/escalation actions, and an environment-configurable SMTP notification workflow featuring email masking and duplicate cooldown protection.

---

## 🛠️ Technical Stack Summary for Resume

- **Backend**: Python 3.13, FastAPI, Uvicorn, PyPDF, Pandas, PyJWT, Passlib, SMTP (`smtplib`)
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Axios, Recharts, html2pdf.js
- **AI / LLM Integration**: Google Gemini API (`google-genai` SDK, `gemini-2.5-flash`)
- **Testing & Quality**: Python `unittest`, `FastAPI TestClient` (17 automated tests)
- **Data Persistence**: File-based tenant-isolated JSON ledgers (`get_tenant_file`)
