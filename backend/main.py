import os
import json
import io
import uuid
import hashlib
from datetime import datetime
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from pypdf import PdfReader
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Load environment variables
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
print("Loaded Key:", os.getenv("GEMINI_API_KEY"))

SENDER_EMAIL = "company.auditor.bot@gmail.com" 
MANAGER_EMAIL = "manager@example.com"

app = FastAPI(title="Compliance Auditor AI API")

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HISTORY_FILE = "history.json"

def get_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []

def save_to_history(record):
    history = get_history()
    history.insert(0, record)  # Prepend so newest is first
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)

# --- STRICT PYDANTIC SCHEMAS FOR GEMINI STRUCTURED OUTPUT ---
class RiskDistribution(BaseModel):
    Low: int = Field(default=0)
    Medium: int = Field(default=0)
    High: int = Field(default=0)
    Critical: int = Field(default=0)

class DepartmentViolations(BaseModel):
    Finance: int = Field(default=0)
    HR: int = Field(default=0)
    IT: int = Field(default=0)
    Sales: int = Field(default=0)
    Ops: int = Field(default=0)

class Metrics(BaseModel):
    compliance_score: int
    risk_distribution: RiskDistribution
    violations_by_department: DepartmentViolations
    compliance_trend: list[int]

class Violation(BaseModel):
    id: int
    employee: str = Field(default="Unknown", description="Employee identifier or username")
    department: str = Field(default="Unknown", description="Inferred or explicitly stated department")
    rule_violated: str = Field(description="Summary of policy rule violated")
    log_entry: str = Field(description="Exact log entry evidence")
    severity: str = Field(description="Must be Critical, High, Medium, or Low")
    explanation: str = Field(description="Concise 1-sentence explanation")
    recommendation: str = Field(description="Concise 1-sentence mitigation recommendation")
    status: str = Field(default="OPEN", description="Must be OPEN, IN_PROGRESS, MITIGATED, or FALSE_POSITIVE")
    mitigation_notes: str = Field(default="", description="Auditor mitigation notes")

class ViolationUpdate(BaseModel):
    status: str = Field(..., description="Must be OPEN, IN_PROGRESS, MITIGATED, or FALSE_POSITIVE")
    mitigation_notes: str = Field(None, description="Optional auditor mitigation notes")

class AuditResponse(BaseModel):
    metrics: Metrics
    violations: list[Violation]


# --- PYDANTIC SCHEMAS FOR COMPARISON ENDPOINT ---
class ComparisonSummary(BaseModel):
    score_difference: int
    previous_score: int
    current_score: int
    overall_risk_change: str  # "IMPROVED", "REGRESSED", or "UNCHANGED"
    risk_trend_confidence: str
    new_violations_count: int
    resolved_violations_count: int
    unchanged_violations_count: int
    new_violations: list[dict]
    resolved_violations: list[dict]
    unchanged_violations: list[dict]
    severity_breakdown_difference: dict[str, int]
    department_breakdown_difference: dict[str, int]
    comparison_summary: str


def make_violation_fingerprint(v: dict) -> str:
    """Generates a stable fingerprint for a violation using rule + log entry."""
    raw_key = f"{v.get('rule_violated', '')}:{v.get('log_entry', '')}"
    return hashlib.md5(raw_key.encode('utf-8')).hexdigest()


def send_violation_alert(rule, severity, log_evidence, recipient_email):
    try:
        subject = f"🚨 URGENT: {severity} Policy Violation Detected"
        body = f"""
        Enterprise AI Auditor has detected a new policy violation.
        
        Severity: {severity}
        Rule Violated: {rule}
        Log Evidence: {log_evidence}
        
        Please log in to the dashboard immediately to review the recommended action.
        """
        
        print("\n" + "="*50)
        print(f"✅ [MOCK EMAIL SENT TO {recipient_email}]")
        print(f"Subject: {subject}")
        print(body)
        print("="*50 + "\n")
        
    except Exception as e:
        print(f"❌ Failed to process email alert: {e}")

def extract_text_from_file(file: UploadFile) -> str:
    content = file.file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        pdf_reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages[:5]:  # Limit to first 5 pages
            text += page.extract_text() or ""
        return text.strip()
        
    elif filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
        if len(df) > 30:
            df = df.head(30)
        return df.to_string()
        
    elif filename.endswith((".txt", ".json", ".log")):
        text = content.decode("utf-8", errors="ignore").strip()
        return text[:8000]
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format: {file.filename}"
        )

# --- BASE ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "online", "message": "Compliance Auditor AI API is active!"}

@app.get("/api/history")
def get_audit_history():
    return get_history()

# --- AUDIT COMPARISON ENDPOINTS ---

@app.get("/api/audits")
def list_audits(
    min_score: int = Query(None, description="Filter audits by minimum compliance score"),
    search: str = Query(None, description="Search term matching policy or log filename"),
    sort_by: str = Query("timestamp_desc", description="Sort parameter (timestamp_desc, timestamp_asc, score_desc, score_asc)")
):
    """Retrieve list of all historical audit scans with optional filtering and sorting."""
    history = get_history()
    results = []
    for item in history:
        score = item.get("metrics", {}).get("compliance_score", 0)
        policy_fn = item.get("policy_filename", "")
        log_fn = item.get("log_filename", "")
        
        # Filter by min_score
        if min_score is not None and score < min_score:
            continue
            
        # Filter by search term
        if search:
            search_lower = search.lower()
            if search_lower not in policy_fn.lower() and search_lower not in log_fn.lower():
                continue
                
        results.append({
            "id": item.get("id"),
            "timestamp": item.get("timestamp"),
            "policy_filename": policy_fn,
            "log_filename": log_fn,
            "compliance_score": score,
            "total_violations": len(item.get("violations", []))
        })
        
    # Sorting
    if sort_by == "timestamp_asc":
        results.sort(key=lambda x: x.get("timestamp", ""))
    elif sort_by == "score_desc":
        results.sort(key=lambda x: x.get("compliance_score", 0), reverse=True)
    elif sort_by == "score_asc":
        results.sort(key=lambda x: x.get("compliance_score", 0))
    else:  # Default to timestamp_desc
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
    return results

# IMPORTANT: /api/audits/compare MUST be declared BEFORE /api/audits/{audit_id}
@app.get("/api/audits/compare", response_model=ComparisonSummary)
def compare_audits(
    prev_id: str = Query(..., description="ID of previous audit scan"),
    curr_id: str = Query(..., description="ID of current audit scan")
):
    """Compares two saved audits and returns delta metrics."""
    history = get_history()
    
    prev_audit = next((item for item in history if item.get("id") == prev_id), None)
    curr_audit = next((item for item in history if item.get("id") == curr_id), None)

    if not prev_audit or not curr_audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both audit IDs were not found in history."
        )

    # 1. Scores & Risk Delta
    prev_score = prev_audit.get("metrics", {}).get("compliance_score", 0)
    curr_score = curr_audit.get("metrics", {}).get("compliance_score", 0)
    score_diff = curr_score - prev_score

    if score_diff > 0:
        overall_risk_change = "IMPROVED"
    elif score_diff < 0:
        overall_risk_change = "REGRESSED"
    else:
        overall_risk_change = "UNCHANGED"

    # 2. Violation Matching using Stable Fingerprints
    prev_violations = {make_violation_fingerprint(v): v for v in prev_audit.get("violations", [])}
    curr_violations = {make_violation_fingerprint(v): v for v in curr_audit.get("violations", [])}

    prev_keys = set(prev_violations.keys())
    curr_keys = set(curr_violations.keys())

    new_keys = curr_keys - prev_keys
    resolved_keys = prev_keys - curr_keys
    unchanged_keys = curr_keys & prev_keys

    new_violations = [curr_violations[k] for k in new_keys]
    resolved_violations = [prev_violations[k] for k in resolved_keys]
    unchanged_violations = [curr_violations[k] for k in unchanged_keys]

    # 3. Severity Breakdown Difference
    prev_sev = prev_audit.get("metrics", {}).get("risk_distribution", {})
    curr_sev = curr_audit.get("metrics", {}).get("risk_distribution", {})
    
    sev_keys = set(list(prev_sev.keys()) + list(curr_sev.keys()))
    sev_diff = {
        k: curr_sev.get(k, 0) - prev_sev.get(k, 0) for k in sev_keys
    }

    # 4. Department Breakdown Difference
    prev_dept = prev_audit.get("metrics", {}).get("violations_by_department", {})
    curr_dept = curr_audit.get("metrics", {}).get("violations_by_department", {})

    dept_keys = set(list(prev_dept.keys()) + list(curr_dept.keys()))
    dept_diff = {
        k: curr_dept.get(k, 0) - prev_dept.get(k, 0) for k in dept_keys
    }

    # 5. Natural Language Summary Generation
    summary_parts = []
    if score_diff > 0:
        summary_parts.append(f"Compliance score improved by {score_diff} points (from {prev_score} to {curr_score}).")
    elif score_diff < 0:
        summary_parts.append(f"Compliance score dropped by {abs(score_diff)} points (from {prev_score} to {curr_score}).")
    else:
        summary_parts.append(f"Compliance score remained unchanged at {curr_score}.")

    summary_parts.append(f"Identified {len(new_violations)} new violation(s) and resolved {len(resolved_violations)} previous violation(s).")

    if len(new_violations) > 0:
        top_new_rule = new_violations[0].get("rule_violated", "Unknown Rule")
        summary_parts.append(f"Primary new issue detected: '{top_new_rule}'.")

    return {
        "score_difference": score_diff,
        "previous_score": prev_score,
        "current_score": curr_score,
        "overall_risk_change": overall_risk_change,
        "risk_trend_confidence": "HIGH (Fingerprint Match)",
        "new_violations_count": len(new_violations),
        "resolved_violations_count": len(resolved_violations),
        "unchanged_violations_count": len(unchanged_violations),
        "new_violations": new_violations,
        "resolved_violations": resolved_violations,
        "unchanged_violations": unchanged_violations,
        "severity_breakdown_difference": sev_diff,
        "department_breakdown_difference": dept_diff,
        "comparison_summary": " ".join(summary_parts)
    }

@app.get("/api/audits/{audit_id}")
def get_audit_by_id(audit_id: str):
    """Retrieve a single audit record by its ID."""
    history = get_history()
    for item in history:
        if item.get("id") == audit_id:
            # Ensure violations have default status/mitigation_notes
            violations = item.get("violations", [])
            for v in violations:
                if "status" not in v:
                    v["status"] = "OPEN"
                if "mitigation_notes" not in v:
                    v["mitigation_notes"] = ""
            return item
    raise HTTPException(status_code=404, detail="Audit record not found")

@app.patch("/api/audits/{audit_id}/violations/{violation_id}")
def update_violation(audit_id: str, violation_id: int, update_data: ViolationUpdate):
    """Update status and mitigation notes of a specific violation."""
    history = get_history()
    audit_found = False
    violation_found = False
    
    valid_statuses = ["OPEN", "IN_PROGRESS", "MITIGATED", "FALSE_POSITIVE"]
    status_upper = update_data.status.upper()
    if status_upper not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of {valid_statuses}"
        )
        
    for item in history:
        if item.get("id") == audit_id:
            audit_found = True
            violations = item.get("violations", [])
            for v in violations:
                if v.get("id") == violation_id:
                    violation_found = True
                    v["status"] = status_upper
                    if update_data.mitigation_notes is not None:
                        v["mitigation_notes"] = update_data.mitigation_notes
                    break
            if violation_found:
                break
                
    if not audit_found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit record not found")
    if not violation_found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found in this audit record")
        
    # Save the updated history back to HISTORY_FILE
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)
        
    return {"status": "success", "message": "Violation updated successfully"}

@app.post("/api/audit")
def execute_audit(
    policy_file: UploadFile = File(...),
    log_file: UploadFile = File(...),
    hr_email: str = Form(None)
):
    # Validate hr_email presence and format
    if not hr_email or not hr_email.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="HR corporate email is required."
        )
    recipient = hr_email.strip()
    import re
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", recipient):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid HR corporate email address format."
        )

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GEMINI_API_KEY environment variable is missing."
        )

    try:
        # 1. Extract text from uploaded files
        policy_text = extract_text_from_file(policy_file)
        log_text = extract_text_from_file(log_file)
        
        # 2. Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
You are an expert IT Compliance and Security Auditor. 
Compare the following Company Policy Document with the System Logs File.
Identify the top policy violations, breaches, or security anomalies present in the logs.

COMPANY POLICY:
{policy_text}

SYSTEM LOGS:
{log_text}

Analyze the violations to calculate metrics for a dashboard:
1. Calculate an overall compliance score (0-100) where 100 is perfect compliance.
2. Count the violations by severity ("Low", "Medium", "High", "Critical").
3. Count the violations by inferred department ("Finance", "HR", "IT", "Sales", "Ops"). If department isn't explicit in the logs, infer it from the action or assign it proportionally.
4. Generate a plausible 6-week compliance score trend array (6 integers) ending with the current compliance score.

For each violation, extract or infer the 'employee' (e.g., E-1042 or username) and 'department'.

INSTRUCTIONS:
- Identify NO MORE THAN 5-8 most critical violations to prevent token overflow.
- Keep explanation and recommendation brief (1 short sentence each).
"""

        # 3. Call Gemini API with strict structured schema output
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AuditResponse,
                temperature=0.1
            )
        )

        # 4. Safely parse structured JSON
        raw_text = response.text or ""
        clean_text = raw_text.strip().replace("```json", "").replace("```", "")
        
        if not clean_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gemini returned an empty response. Try uploading a smaller file."
            )

        audit_result = json.loads(clean_text)

        # 5. Email Alert Trigger Logic for High/Critical Violations
        violations = audit_result.get("violations", [])
        high_critical_count = 0
        for violation in violations:
            sev = str(violation.get("severity", "")).upper()
            if sev in ["HIGH", "CRITICAL"]:
                high_critical_count += 1
                send_violation_alert(
                    rule=violation.get("rule_violated", "Unknown Rule"),
                    severity=sev,
                    log_evidence=violation.get("log_entry", "See Dashboard for details"),
                    recipient_email=recipient
                )

        alert_triggered = high_critical_count > 0
        alert_info = {
            "triggered": alert_triggered,
            "recipient": recipient,
            "violation_count": high_critical_count,
            "message": f"Mock email alert sent to {recipient}" if alert_triggered else "No critical or high violations found. No email alert triggered."
        }

        # 6. Save audit record with metadata to history
        record_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Set default values for status and mitigation_notes if not present
        for violation in violations:
            if "status" not in violation:
                violation["status"] = "OPEN"
            if "mitigation_notes" not in violation:
                violation["mitigation_notes"] = ""
        
        audit_record = {
            "id": record_id,
            "timestamp": timestamp,
            "policy_filename": policy_file.filename,
            "log_filename": log_file.filename,
            "metrics": audit_result.get("metrics", {}),
            "violations": violations,
            "alert": alert_info
        }
        
        save_to_history(audit_record)
        return audit_record

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse audit results. Try using a smaller log file."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audit execution failed: {str(e)}"
        )