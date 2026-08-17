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
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Query, Request
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
    id: str | int
    employee: str = Field(default="Unknown", description="Employee identifier or username")
    department: str = Field(default="Unknown", description="Inferred or explicitly stated department")
    rule_violated: str = Field(description="Summary of policy rule violated")
    log_entry: str = Field(description="Exact log entry evidence")
    severity: str = Field(description="Must be Critical, High, Medium, or Low")
    explanation: str = Field(description="Concise 1-sentence explanation")
    recommendation: str = Field(description="Concise 1-sentence mitigation recommendation")
    status: str = Field(default="OPEN", description="Lifecycle status")
    mitigation_notes: str = Field(default="", description="Auditor mitigation notes")
    assigned_employee_id: str | None = Field(default=None)
    assigned_employee_name: str | None = Field(default=None)
    due_date: str | None = Field(default=None)
    mitigation_evidence_url: str | None = Field(default=None)
    mitigation_evidence_title: str | None = Field(default=None)
    employee_mitigation_notes: str | None = Field(default=None)
    reviewer_comments: str | None = Field(default=None)
    submitted_for_verification_at: str | None = Field(default=None)
    verified_at: str | None = Field(default=None)
    verified_by: str | None = Field(default=None)
    created_at: str | None = Field(default=None)
    updated_at: str | None = Field(default=None)

class ViolationUpdate(BaseModel):
    status: str = Field(..., description="Must be OPEN, IN_PROGRESS, MITIGATED, or FALSE_POSITIVE")
    mitigation_notes: str = Field(None, description="Optional auditor mitigation notes")

class SubmitVerificationRequest(BaseModel):
    mitigation_evidence_url: str = Field(..., max_length=2000)
    mitigation_evidence_title: str = Field(..., max_length=255)
    employee_mitigation_notes: str = Field(..., max_length=5000)

class ReviewRequest(BaseModel):
    action: str = Field(...)  # APPROVE, REJECT, or REOPEN
    comment: str = Field(None, max_length=5000)

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

MAX_FILE_COUNT = 5
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_TOTAL_SIZE = 20 * 1024 * 1024  # 20 MB

MAX_EXTRACT_PER_POLICY = 10000
MAX_EXTRACT_PER_LOG = 15000
MAX_COMBINED_POLICY_TEXT = 30000
MAX_COMBINED_LOG_TEXT = 45000

ALLOWED_POLICY_EXTENSIONS = {".pdf", ".txt"}
ALLOWED_LOG_EXTENSIONS = {".csv", ".txt", ".json"}

def extract_text_from_file(file: UploadFile, max_chars: int) -> str:
    content = file.file.read()
    file.file.seek(0)  # Reset pointer
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        pdf_reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
            if len(text) >= max_chars:
                break
        return text[:max_chars].strip()
        
    elif filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
        if len(df) > 30:
            df = df.head(30)
        return df.to_string()[:max_chars]
        
    elif filename.endswith((".txt", ".json", ".log")):
        text = content.decode("utf-8", errors="ignore").strip()
        return text[:max_chars]
        
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
    policy_files: list[UploadFile] = File(...),
    log_files: list[UploadFile] = File(...),
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

    # 1. Validation & Preprocessing
    if len(policy_files) > MAX_FILE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum policy file limit exceeded. Maximum: {MAX_FILE_COUNT} files."
        )
    if len(log_files) > MAX_FILE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum logs file limit exceeded. Maximum: {MAX_FILE_COUNT} files."
        )

    skipped_files = []
    processed_policy_metadata = []
    processed_log_metadata = []
    total_processed_size = 0

    valid_policy_files = []
    valid_log_files = []

    # Validate Policy Files
    for pf in policy_files:
        pf.file.seek(0, os.SEEK_END)
        size = pf.file.tell()
        pf.file.seek(0)

        ext = os.path.splitext(pf.filename)[1].lower()
        if ext not in ALLOWED_POLICY_EXTENSIONS:
            skipped_files.append({
                "filename": pf.filename,
                "reason": f"Unsupported extension. Allowed: {', '.join(ALLOWED_POLICY_EXTENSIONS)}"
            })
            continue

        if size > MAX_FILE_SIZE:
            skipped_files.append({
                "filename": pf.filename,
                "reason": f"File size exceeds 5 MB limit ({size / (1024*1024):.2f} MB)"
            })
            continue

        total_processed_size += size
        valid_policy_files.append((pf, size))

    # Validate Log Files
    for lf in log_files:
        lf.file.seek(0, os.SEEK_END)
        size = lf.file.tell()
        lf.file.seek(0)

        ext = os.path.splitext(lf.filename)[1].lower()
        if ext not in ALLOWED_LOG_EXTENSIONS:
            skipped_files.append({
                "filename": lf.filename,
                "reason": f"Unsupported extension. Allowed: {', '.join(ALLOWED_LOG_EXTENSIONS)}"
            })
            continue

        if size > MAX_FILE_SIZE:
            skipped_files.append({
                "filename": lf.filename,
                "reason": f"File size exceeds 5 MB limit ({size / (1024*1024):.2f} MB)"
            })
            continue

        total_processed_size += size
        valid_log_files.append((lf, size))

    # Total Request Size Check
    if total_processed_size > MAX_TOTAL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total upload size of {total_processed_size / (1024*1024):.2f} MB exceeds the 20 MB limit."
        )

    if not valid_policy_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid policy documents to audit. Make sure they are under 5 MB and in .pdf or .txt format."
        )

    if not valid_log_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid system log files to audit. Make sure they are under 5 MB and in .csv, .txt or .json format."
        )

    try:
        # Extract and compile policy files
        policy_texts = []
        for f, size in valid_policy_files:
            text = extract_text_from_file(f, MAX_EXTRACT_PER_POLICY)
            policy_texts.append(f"--- POLICY FILE: {f.filename} ---\n{text}")
            processed_policy_metadata.append({"filename": f.filename, "size": size})
        policy_text = "\n\n".join(policy_texts)[:MAX_COMBINED_POLICY_TEXT]

        # Extract and combine log files
        log_texts = []
        for f, size in valid_log_files:
            text = extract_text_from_file(f, MAX_EXTRACT_PER_LOG)
            log_texts.append(f"--- LOG FILE: {f.filename} ---\n{text}")
            processed_log_metadata.append({"filename": f.filename, "size": size})
        log_text = "\n\n".join(log_texts)[:MAX_COMBINED_LOG_TEXT]

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
        
        # Initialize lifecycle fields and assign globally unique violation IDs
        from datetime import timedelta
        for idx, violation in enumerate(violations):
            unique_vio_id = f"VIO-{record_id[:8]}-{idx+1}"
            violation["id"] = unique_vio_id
            violation["status"] = "OPEN"
            violation["assigned_employee_id"] = "EMP-3430"
            violation["assigned_employee_name"] = "Ross Security"
            violation["department"] = violation.get("department", "IT")
            violation["due_date"] = (datetime.now() + timedelta(days=7)).date().isoformat()
            violation["mitigation_evidence_url"] = None
            violation["mitigation_evidence_title"] = None
            violation["employee_mitigation_notes"] = None
            violation["reviewer_comments"] = None
            violation["submitted_for_verification_at"] = None
            violation["verified_at"] = None
            violation["verified_by"] = None
            violation["created_at"] = timestamp
            violation["updated_at"] = timestamp
            violation["mitigation_notes"] = ""
        
        audit_record = {
            "id": record_id,
            "timestamp": timestamp,
            "policy_filename": ", ".join([f["filename"] for f in processed_policy_metadata]),
            "log_filename": ", ".join([f["filename"] for f in processed_log_metadata]),
            "processed_policies": processed_policy_metadata,
            "processed_logs": processed_log_metadata,
            "skipped_files": skipped_files,
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

# =====================================================================
# --- VERIFIED MITIGATION LIFECYCLE FEATURE BACKEND EXTENSIONS ---
# =====================================================================

ACTIVITY_FILE = "activity.json"

def get_activities():
    if not os.path.exists(ACTIVITY_FILE):
        return []
    try:
        with open(ACTIVITY_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []

def save_activity(activity: dict):
    activities = get_activities()
    activities.append(activity)
    with open(ACTIVITY_FILE, "w") as f:
        json.dump(activities, f, indent=4)

def get_all_violations_flat():
    history = get_history()
    violations = []
    for audit in history:
        audit_id = audit.get("id")
        for idx, vio in enumerate(audit.get("violations", [])):
            if "id" not in vio or not isinstance(vio["id"], str) or not vio["id"].startswith("VIO-"):
                vio["id"] = f"VIO-{audit_id[:8]}-{idx+1}"
            
            if "status" not in vio:
                vio["status"] = "OPEN"
            if "assigned_employee_id" not in vio:
                vio["assigned_employee_id"] = "EMP-3430"
            if "assigned_employee_name" not in vio:
                vio["assigned_employee_name"] = "Ross Security"
            if "department" not in vio:
                vio["department"] = "IT"
            if "due_date" not in vio:
                vio["due_date"] = "2026-08-24"
            if "mitigation_evidence_url" not in vio:
                vio["mitigation_evidence_url"] = None
            if "mitigation_evidence_title" not in vio:
                vio["mitigation_evidence_title"] = None
            if "employee_mitigation_notes" not in vio:
                vio["employee_mitigation_notes"] = None
            if "reviewer_comments" not in vio:
                vio["reviewer_comments"] = None
            if "submitted_for_verification_at" not in vio:
                vio["submitted_for_verification_at"] = None
            if "verified_at" not in vio:
                vio["verified_at"] = None
            if "verified_by" not in vio:
                vio["verified_by"] = None
            if "created_at" not in vio:
                vio["created_at"] = audit.get("timestamp", datetime.now().isoformat())
            if "updated_at" not in vio:
                vio["updated_at"] = vio.get("created_at")
            if "mitigation_notes" not in vio:
                vio["mitigation_notes"] = ""
            
            violations.append((audit_id, vio))
    return violations

def update_violation_in_history(violation_id: str, updated_vio: dict):
    history = get_history()
    found = False
    for audit in history:
        for vio in audit.get("violations", []):
            if vio.get("id") == violation_id:
                vio.update(updated_vio)
                found = True
                break
        if found:
            break
    if found:
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=4)
        return True
    return False

# Mock Authentication Token Resolver
from fastapi import Header, Depends
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        # Strict requirement: deriving identity from auth header.
        # Fallback to employee for simple local dev testing
        return {
            "email": "employee.ross@security-hq.com",
            "role": "EMPLOYEE",
            "employee_id": "EMP-3430",
            "name": "Ross"
        }
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid token.")
    
    token = authorization[7:].strip()
    parts = token.split(":")
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token format.")
    
    email, role = parts[0], parts[1].upper()
    emp_id = "EMP-3430" if "ross" in email.lower() else email.split("@")[0].upper()
    name = email.split("@")[0].capitalize()
    
    return {
        "email": email,
        "role": role,
        "employee_id": emp_id,
        "name": name
    }

# Seed Demo Lifecycle Data on startup
def seed_data_if_empty():
    history = get_history()
    if not history:
        audit_id = "audit-demo-123"
        
        now_utc = datetime.utcnow()
        timestamp = now_utc.isoformat() + "Z"
        
        # 1. VIO-demo-1 (Critical: 82% SLA consumed)
        # Resolution limit is 24 hours. 82% elapsed: 19.68 hours ago (19 hours and 40 minutes)
        vio1_created = now_utc - timedelta(hours=19.68)
        vio1_created_str = vio1_created.isoformat() + "Z"
        vio1_ack_due = (vio1_created + timedelta(hours=1)).isoformat() + "Z"
        vio1_res_due = (vio1_created + timedelta(hours=24)).isoformat() + "Z"
        
        # 2. VIO-demo-2 (High: Breached, resolution deadline 48 hours. Staged 60 hours ago. Breached 12 hours ago.)
        vio2_created = now_utc - timedelta(hours=60)
        vio2_created_str = vio2_created.isoformat() + "Z"
        vio2_ack_due = (vio2_created + timedelta(hours=4)).isoformat() + "Z"
        vio2_res_due = (vio2_created + timedelta(hours=48)).isoformat() + "Z"
        
        # 3. VIO-demo-3 (High: Pending verification)
        vio3_created = now_utc - timedelta(hours=5)
        vio3_created_str = vio3_created.isoformat() + "Z"
        vio3_ack_due = (vio3_created + timedelta(hours=4)).isoformat() + "Z"
        vio3_res_due = (vio3_created + timedelta(hours=48)).isoformat() + "Z"
        
        # 4. VIO-demo-4 (Low: Resolved)
        vio4_created = now_utc - timedelta(days=5)
        vio4_created_str = vio4_created.isoformat() + "Z"
        vio4_res_due = (vio4_created + timedelta(days=14)).isoformat() + "Z"
        
        violations = [
            {
                "id": "VIO-demo-1",
                "employee": "EMP-3430",
                "department": "IT Ops",
                "rule_violated": "Policy 3.2 - Open Access Key in Version Control",
                "log_entry": "GitHub Commit push: Repo 'ross-analytics-dashboard', File: 'env.local', Secret: 'sk_live_...2ross'",
                "severity": "Critical",
                "explanation": "An active access key 'sk_live_...2ross' was committed to a public Git repository. High leak hazard.",
                "recommendation": "Rotate the access secret immediately and delete the GitHub commit log history.",
                "status": "OPEN",
                "assigned_employee_id": "EMP-3430",
                "assigned_employee_name": "Ross",
                "due_date": "2026-08-24",
                "mitigation_evidence_url": None,
                "mitigation_evidence_title": None,
                "employee_mitigation_notes": None,
                "reviewer_comments": None,
                "submitted_for_verification_at": None,
                "verified_at": None,
                "verified_by": None,
                "created_at": vio1_created_str,
                "updated_at": vio1_created_str,
                "mitigation_notes": "",
                "sla": {
                    "acknowledgment_due_at": vio1_ack_due,
                    "resolution_due_at": vio1_res_due,
                    "acknowledged_at": None,
                    "resolved_at": None,
                    "sla_status": "WARNING_80",
                    "sla_percent_elapsed": 82,
                    "time_remaining_seconds": int((vio1_created + timedelta(hours=24) - now_utc).total_seconds()),
                    "warning_50_sent": True,
                    "warning_80_sent": True,
                    "breach_notification_sent": False,
                    "escalation_level": 0,
                    "last_escalated_at": None
                },
                "assigned_to": {
                    "employee_id": "EMP-3430",
                    "name": "Ross",
                    "email": "employee.ross@security-hq.com",
                    "department": "IT Ops",
                    "department_lead_name": "IT Manager",
                    "department_lead_email": "manager@example.com"
                }
            },
            {
                "id": "VIO-demo-2",
                "employee": "EMP-3430",
                "department": "Sales & Marketing",
                "rule_violated": "Policy 4.3 - Training Completion Requirements",
                "log_entry": "Employee ID: Ross, DepartmentType: Sales, Training Date: 12-Feb-26, Status: Incomplete",
                "severity": "High",
                "explanation": "Employee Ross's security training is marked 'Incomplete' after exceeding the standard 60-day company requirement.",
                "recommendation": "Immediately access the training portal and complete the module by the end of the current cycle.",
                "status": "IN_PROGRESS",
                "assigned_employee_id": "EMP-3430",
                "assigned_employee_name": "Ross",
                "due_date": "2026-08-20",
                "mitigation_evidence_url": None,
                "mitigation_evidence_title": None,
                "employee_mitigation_notes": None,
                "reviewer_comments": None,
                "submitted_for_verification_at": None,
                "verified_at": None,
                "verified_by": None,
                "created_at": vio2_created_str,
                "updated_at": (vio2_created + timedelta(minutes=5)).isoformat() + "Z",
                "mitigation_notes": "Ross started training remediation.",
                "sla": {
                    "acknowledgment_due_at": vio2_ack_due,
                    "resolution_due_at": vio2_res_due,
                    "acknowledged_at": (vio2_created + timedelta(hours=2)).isoformat() + "Z",
                    "resolved_at": None,
                    "sla_status": "ESCALATED",
                    "sla_percent_elapsed": 100,
                    "time_remaining_seconds": 0,
                    "warning_50_sent": True,
                    "warning_80_sent": True,
                    "breach_notification_sent": True,
                    "escalation_level": 1,
                    "last_escalated_at": (vio2_created + timedelta(hours=48)).isoformat() + "Z"
                },
                "assigned_to": {
                    "employee_id": "EMP-3430",
                    "name": "Ross",
                    "email": "employee.ross@security-hq.com",
                    "department": "Sales & Marketing",
                    "department_lead_name": "Sales Manager",
                    "department_lead_email": "sales-manager@example.com"
                }
            },
            {
                "id": "VIO-demo-3",
                "employee": "EMP-3430",
                "department": "IT Ops",
                "rule_violated": "Policy 1.4 - Unauthenticated Financial Transactions",
                "log_entry": "MFA bypassed for $250,000 wire transfer from account 90812347 to 882103",
                "severity": "High",
                "explanation": "A financial wire transfer of $250,000 was executed without verified Multi-Factor Authentication.",
                "recommendation": "Verify transactions under dual-custody approval and attach transaction ticket credentials.",
                "status": "PENDING_VERIFICATION",
                "assigned_employee_id": "EMP-3430",
                "assigned_employee_name": "Ross",
                "due_date": "2026-08-18",
                "mitigation_evidence_url": "https://tickets.company.com/SEC-882",
                "mitigation_evidence_title": "Ticket SEC-882",
                "employee_mitigation_notes": "Approved wire transfer under emergency CFO authorization. Ref ticket #SEC-882.",
                "reviewer_comments": None,
                "submitted_for_verification_at": (vio3_created + timedelta(hours=1)).isoformat() + "Z",
                "verified_at": None,
                "verified_by": None,
                "created_at": vio3_created_str,
                "updated_at": (vio3_created + timedelta(hours=1)).isoformat() + "Z",
                "mitigation_notes": "",
                "sla": {
                    "acknowledgment_due_at": vio3_ack_due,
                    "resolution_due_at": vio3_res_due,
                    "acknowledged_at": (vio3_created + timedelta(minutes=30)).isoformat() + "Z",
                    "resolved_at": None,
                    "sla_status": "ON_TRACK",
                    "sla_percent_elapsed": int(((now_utc - vio3_created).total_seconds() / (48 * 3600)) * 100),
                    "time_remaining_seconds": int((vio3_created + timedelta(hours=48) - now_utc).total_seconds()),
                    "warning_50_sent": False,
                    "warning_80_sent": False,
                    "breach_notification_sent": False,
                    "escalation_level": 0,
                    "last_escalated_at": None
                },
                "assigned_to": {
                    "employee_id": "EMP-3430",
                    "name": "Ross",
                    "email": "employee.ross@security-hq.com",
                    "department": "IT Ops",
                    "department_lead_name": "IT Manager",
                    "department_lead_email": "manager@example.com"
                }
            },
            {
                "id": "VIO-demo-4",
                "employee": "EMP-3430",
                "department": "Finance",
                "rule_violated": "Policy 4.1 - Unauthorised PII Access",
                "log_entry": "Direct SQL select query executed on salary table from ip 192.168.1.42",
                "severity": "Low",
                "explanation": "Direct SELECT query on salary table was executed without authorized access control token.",
                "recommendation": "Restrict database access control layers and lock unauthorized direct console query options.",
                "status": "RESOLVED",
                "assigned_employee_id": "EMP-3430",
                "assigned_employee_name": "Ross",
                "due_date": "2026-08-15",
                "mitigation_evidence_url": "https://github.com/org/repo/pull/123",
                "mitigation_evidence_title": "PR #123",
                "employee_mitigation_notes": "Salary table access revoked for non-HR IPs. IP security rule merged in PR.",
                "reviewer_comments": "Verified PR change. Direct select logs restricted. Secure and resolved.",
                "submitted_for_verification_at": (vio4_created + timedelta(days=2)).isoformat() + "Z",
                "verified_at": (vio4_created + timedelta(days=3)).isoformat() + "Z",
                "verified_by": "auditor.compliance@firm-wide.com",
                "created_at": vio4_created_str,
                "updated_at": (vio4_created + timedelta(days=3)).isoformat() + "Z",
                "mitigation_notes": "",
                "sla": {
                    "acknowledgment_due_at": None,
                    "resolution_due_at": vio4_res_due,
                    "acknowledged_at": None,
                    "resolved_at": (vio4_created + timedelta(days=3)).isoformat() + "Z",
                    "sla_status": "RESOLVED",
                    "sla_percent_elapsed": int(((3 * 24 * 3600) / (14 * 24 * 3600)) * 100),
                    "time_remaining_seconds": 0,
                    "warning_50_sent": False,
                    "warning_80_sent": False,
                    "breach_notification_sent": False,
                    "escalation_level": 0,
                    "last_escalated_at": None
                },
                "assigned_to": {
                    "employee_id": "EMP-3430",
                    "name": "Ross",
                    "email": "employee.ross@security-hq.com",
                    "department": "Finance",
                    "department_lead_name": "Finance Lead",
                    "department_lead_email": "finance.lead@company.com"
                }
            }
        ]
        
        audit_record = {
            "id": audit_id,
            "timestamp": timestamp,
            "policy_filename": "Global_Security_Policy_v2.pdf",
            "log_filename": "production_auth_logs.csv",
            "processed_policies": [{"filename": "Global_Security_Policy_v2.pdf", "size": 124500}],
            "processed_logs": [{"filename": "production_auth_logs.csv", "size": 95600}],
            "skipped_files": [],
            "metrics": {
                "compliance_score": 85,
                "risk_distribution": {"Low": 1, "Medium": 0, "High": 2, "Critical": 1},
                "violations_by_department": {"Finance": 1, "HR": 0, "IT": 2, "Sales": 1, "Ops": 0},
                "compliance_trend": [80, 81, 82, 83, 84, 85]
            },
            "violations": violations,
            "alert": {"triggered": True, "recipient": "auditor.compliance@firm-wide.com", "violation_count": 3, "message": "Demo Seeding Alerts Triggered."}
        }
        save_to_history(audit_record)
        
        # Seed escalation notification events for VIO-demo-2 (High breached)
        notifs = [
            {
                "notification_id": "NOTIF-SEED-1",
                "violation_id": "VIO-demo-2",
                "event_type": "SLA_CREATED",
                "recipient_name": "Ross",
                "recipient_email": "employee.ross@security-hq.com",
                "channel": "MOCK_EMAIL",
                "status": "SENT",
                "message": "SLA Created: A new compliance violation VIO-demo-2 has been logged.",
                "created_at": (vio2_created + timedelta(minutes=1)).isoformat() + "Z"
            },
            {
                "notification_id": "NOTIF-SEED-2",
                "violation_id": "VIO-demo-2",
                "event_type": "SLA_WARNING_50",
                "recipient_name": "Ross",
                "recipient_email": "employee.ross@security-hq.com",
                "channel": "MOCK_EMAIL",
                "status": "SENT",
                "message": "SLA Reminder: 50% of the resolution deadline for VIO-demo-2 has elapsed.",
                "created_at": (vio2_created + timedelta(hours=24)).isoformat() + "Z"
            },
            {
                "notification_id": "NOTIF-SEED-3",
                "violation_id": "VIO-demo-2",
                "event_type": "SLA_WARNING_80",
                "recipient_name": "Ross",
                "recipient_email": "employee.ross@security-hq.com",
                "channel": "MOCK_EMAIL",
                "status": "SENT",
                "message": "SLA Warning: 80% of the resolution deadline for VIO-demo-2 has elapsed.",
                "created_at": (vio2_created + timedelta(hours=38.4)).isoformat() + "Z"
            },
            {
                "notification_id": "NOTIF-SEED-4",
                "violation_id": "VIO-demo-2",
                "event_type": "SLA_BREACHED",
                "recipient_name": "Sales Manager",
                "recipient_email": "sales-manager@example.com",
                "channel": "MOCK_EMAIL",
                "status": "SENT",
                "message": "SLA BREACHED: High-risk violation VIO-demo-2 has missed its resolution SLA. Department Lead notified.",
                "created_at": (vio2_created + timedelta(hours=48)).isoformat() + "Z"
            }
        ]
        save_notifications(notifs)

        activities = [
            {
                "activity_id": "ACT-demo-1",
                "violation_id": "VIO-demo-2",
                "actor_id": "employee.ross@security-hq.com",
                "actor_name": "Ross",
                "actor_role": "EMPLOYEE",
                "action": "START_MITIGATION",
                "previous_status": "OPEN",
                "new_status": "IN_PROGRESS",
                "comment": "Ross started training remediation.",
                "evidence_url": None,
                "created_at": (vio2_created + timedelta(hours=5)).isoformat() + "Z"
            },
            {
                "activity_id": "ACT-demo-2",
                "violation_id": "VIO-demo-3",
                "actor_id": "employee.ross@security-hq.com",
                "actor_name": "Ross",
                "actor_role": "EMPLOYEE",
                "action": "SUBMIT_MITIGATION",
                "previous_status": "IN_PROGRESS",
                "new_status": "PENDING_VERIFICATION",
                "comment": "Approved wire transfer under CFO emergency approval.",
                "evidence_url": "https://tickets.company.com/SEC-882",
                "created_at": (vio3_created + timedelta(hours=1)).isoformat() + "Z"
            },
            {
                "activity_id": "ACT-demo-3",
                "violation_id": "VIO-demo-4",
                "actor_id": "employee.ross@security-hq.com",
                "actor_name": "Ross",
                "actor_role": "EMPLOYEE",
                "action": "SUBMIT_MITIGATION",
                "previous_status": "IN_PROGRESS",
                "new_status": "PENDING_VERIFICATION",
                "comment": "Salary table access revoked for non-HR IPs.",
                "evidence_url": "https://github.com/org/repo/pull/123",
                "created_at": (vio4_created + timedelta(days=2)).isoformat() + "Z"
            },
            {
                "activity_id": "ACT-demo-4",
                "violation_id": "VIO-demo-4",
                "actor_id": "auditor.compliance@firm-wide.com",
                "actor_name": "HR Reviewer",
                "actor_role": "HR",
                "action": "VERIFIED_RESOLVED",
                "previous_status": "PENDING_VERIFICATION",
                "new_status": "RESOLVED",
                "comment": "Verified PR change. Direct select logs restricted. Secure and resolved.",
                "evidence_url": "https://github.com/org/repo/pull/123",
                "created_at": (vio4_created + timedelta(days=3)).isoformat() + "Z"
            }
        ]
        with open("activity.json", "w") as f:
            json.dump(activities, f, indent=4)

@app.on_event("startup")
def startup_event():
    seed_data_if_empty()
    seed_policies_if_empty()

# Lifecycle Transition Validation Logic
VALID_TRANSITIONS = {
    "OPEN": {"IN_PROGRESS"},
    "IN_PROGRESS": {"PENDING_VERIFICATION"},
    "PENDING_VERIFICATION": {"RESOLVED", "REQUIRES_CHANGES"},
    "REQUIRES_CHANGES": {"IN_PROGRESS"},
    "RESOLVED": {"REOPENED"},
    "REOPENED": {"IN_PROGRESS", "PENDING_VERIFICATION"}
}

def validate_transition(old_status: str, new_status: str):
    allowed = VALID_TRANSITIONS.get(old_status.upper(), set())
    if new_status.upper() not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {old_status} to {new_status}."
        )

# Evidence Validation Helpers
import re
URL_REGEX = re.compile(
    r'^(?:http|ftp)s?://'
    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'
    r'localhost|'
    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
    r'(?::\d+)?'
    r'(?:/?|[/?]\S+)$', re.IGNORECASE)

def validate_url(url: str):
    if not URL_REGEX.match(url):
        raise HTTPException(status_code=400, detail="Invalid URL format. Evidence must be a valid http or https link.")

def validate_evidence(url: str):
    if url.startswith("http://") or url.startswith("https://"):
        validate_url(url)
    elif len(url.strip()) < 3:
        raise HTTPException(status_code=400, detail="Evidence reference/receipt must be at least 3 characters long.")

# API Endpoints
@app.get("/api/violations")
def list_violations(
    status: str = Query(None),
    severity: str = Query(None),
    department: str = Query(None),
    assigned_employee_id: str = Query(None),
    overdue: bool = Query(None),
    current_user: dict = Depends(get_current_user)
):
    all_vios = get_all_violations_flat()
    filtered = []
    
    user_role = current_user["role"]
    user_emp_id = current_user["employee_id"]
    
    for audit_id, vio in all_vios:
        if user_role == "EMPLOYEE" and vio.get("assigned_employee_id") != user_emp_id:
            continue
            
        if status and vio.get("status") != status:
            continue
        if severity and vio.get("severity", "").upper() != severity.upper():
            continue
        if department and vio.get("department", "").upper() != department.upper():
            continue
        if assigned_employee_id and vio.get("assigned_employee_id") != assigned_employee_id:
            continue
        if overdue is not None:
            is_overdue = False
            due_str = vio.get("due_date")
            if due_str and vio.get("status") != "RESOLVED":
                try:
                    due_dt = datetime.strptime(due_str, "%Y-%m-%d").date()
                    if due_dt < datetime.now().date():
                        is_overdue = True
                except ValueError:
                    pass
            if overdue != is_overdue:
                continue
                
        vio_copy = vio.copy()
        vio_copy["audit_id"] = audit_id
        filtered.append(vio_copy)
        
    return filtered

@app.get("/api/violations/sla-summary")
def get_sla_summary(current_user: dict = Depends(get_current_user)):
    violations_flat = get_all_violations_flat()
    
    now_utc = datetime.utcnow()
    for _, vio in violations_flat:
        if "sla" in vio:
            vio["sla"] = calculate_sla_status_and_metrics(vio, now_utc)
            
    unresolved_vios = [vio for _, vio in violations_flat if vio.get("status") != "RESOLVED"]
    
    critical_unack = [vio for vio in unresolved_vios if (vio.get("severity") or "").upper() == "CRITICAL" and not vio.get("sla", {}).get("acknowledged_at")]
    near_breach = [vio for vio in unresolved_vios if vio.get("sla", {}).get("sla_status") in ["WARNING_80", "WARNING_50"]]
    breached = [vio for vio in unresolved_vios if vio.get("sla", {}).get("sla_status") in ["BREACHED", "ACKNOWLEDGMENT_OVERDUE"]]
    escalated = [vio for vio in unresolved_vios if vio.get("sla", {}).get("escalation_level", 0) > 0]
    
    resolved_vios = [vio for _, vio in violations_flat if vio.get("status") == "RESOLVED" and vio.get("sla", {}).get("resolved_at")]
    remediation_times = []
    for vio in resolved_vios:
        try:
            c_str = vio["created_at"]
            if c_str.endswith("Z"): c_str = c_str[:-1]
            r_str = vio["sla"]["resolved_at"]
            if r_str.endswith("Z"): r_str = r_str[:-1]
            dur = (datetime.fromisoformat(r_str) - datetime.fromisoformat(c_str)).total_seconds()
            remediation_times.append(dur)
        except Exception:
            pass
            
    avg_remediation_hours = 0.0
    if remediation_times:
        avg_remediation_hours = round((sum(remediation_times) / len(remediation_times)) / 3600.0, 1)
        
    dept_overdue = {}
    for vio in breached + escalated:
        dept = vio.get("department") or vio.get("assigned_to", {}).get("department", "Unknown")
        dept_overdue[dept] = dept_overdue.get(dept, 0) + 1
        
    return {
        "critical_unacknowledged_count": len(critical_unack),
        "near_breach_count": len(near_breach),
        "breached_count": len(breached),
        "escalated_count": len(escalated),
        "avg_remediation_hours": avg_remediation_hours,
        "departments_overdue": dept_overdue
    }

@app.get("/api/violations/{violation_id}")
def get_violation_by_id(violation_id: str, current_user: dict = Depends(get_current_user)):
    all_vios = get_all_violations_flat()
    for audit_id, vio in all_vios:
        if vio.get("id") == violation_id:
            if current_user["role"] == "EMPLOYEE" and vio.get("assigned_employee_id") != current_user["employee_id"]:
                raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this violation.")
            vio_copy = vio.copy()
            vio_copy["audit_id"] = audit_id
            return vio_copy
    raise HTTPException(status_code=404, detail="Violation not found")

@app.patch("/api/violations/{violation_id}/start-mitigation")
def start_mitigation(violation_id: str, current_user: dict = Depends(get_current_user)):
    all_vios = get_all_violations_flat()
    target_vio = None
    for audit_id, vio in all_vios:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    if current_user["role"] == "EMPLOYEE" and target_vio.get("assigned_employee_id") != current_user["employee_id"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this violation.")
        
    old_status = target_vio.get("status", "OPEN")
    new_status = "IN_PROGRESS"
    
    validate_transition(old_status, new_status)
    
    target_vio["status"] = new_status
    target_vio["updated_at"] = datetime.now().isoformat()
    
    update_violation_in_history(violation_id, target_vio)
    
    act_id = f"ACT-{str(uuid.uuid4())[:8]}"
    activity = {
        "activity_id": act_id,
        "violation_id": violation_id,
        "actor_id": current_user["employee_id"] if current_user["role"] == "EMPLOYEE" else current_user["email"],
        "actor_name": current_user["name"],
        "actor_role": current_user["role"],
        "action": "START_MITIGATION",
        "previous_status": old_status,
        "new_status": new_status,
        "comment": f"{current_user['name']} started remediation.",
        "evidence_url": None,
        "created_at": datetime.now().isoformat()
    }
    save_activity(activity)
    
    return {"status": "success", "violation": target_vio}

@app.post("/api/violations/{violation_id}/submit-verification")
def submit_verification(
    violation_id: str,
    req: SubmitVerificationRequest,
    current_user: dict = Depends(get_current_user)
):
    all_vios = get_all_violations_flat()
    target_vio = None
    for audit_id, vio in all_vios:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    if current_user["role"] == "EMPLOYEE" and target_vio.get("assigned_employee_id") != current_user["employee_id"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this violation.")
        
    old_status = target_vio.get("status", "OPEN")
    new_status = "PENDING_VERIFICATION"
    
    validate_transition(old_status, new_status)
    
    validate_evidence(req.mitigation_evidence_url)
    if not req.mitigation_evidence_title.strip():
        raise HTTPException(status_code=400, detail="Evidence reference title is required.")
    if not req.employee_mitigation_notes.strip():
        raise HTTPException(status_code=400, detail="Mitigation notes are required.")
        
    target_vio["status"] = new_status
    target_vio["mitigation_evidence_url"] = req.mitigation_evidence_url
    target_vio["mitigation_evidence_title"] = req.mitigation_evidence_title
    target_vio["employee_mitigation_notes"] = req.employee_mitigation_notes
    target_vio["submitted_for_verification_at"] = datetime.now().isoformat()
    target_vio["updated_at"] = datetime.now().isoformat()
    
    update_violation_in_history(violation_id, target_vio)
    
    act_id = f"ACT-{str(uuid.uuid4())[:8]}"
    activity = {
        "activity_id": act_id,
        "violation_id": violation_id,
        "actor_id": current_user["employee_id"] if current_user["role"] == "EMPLOYEE" else current_user["email"],
        "actor_name": current_user["name"],
        "actor_role": current_user["role"],
        "action": "SUBMITTED_FOR_VERIFICATION",
        "previous_status": old_status,
        "new_status": new_status,
        "comment": req.employee_mitigation_notes,
        "evidence_url": req.mitigation_evidence_url,
        "created_at": datetime.now().isoformat()
    }
    save_activity(activity)
    
    return {"status": "success", "violation": target_vio}

@app.post("/api/violations/{violation_id}/review")
def review_violation(
    violation_id: str,
    req: ReviewRequest,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="Access denied: Only HR users can review violations.")
        
    all_vios = get_all_violations_flat()
    target_vio = None
    for audit_id, vio in all_vios:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    old_status = target_vio.get("status", "OPEN")
    
    action_upper = req.action.upper()
    if action_upper == "APPROVE":
        new_status = "RESOLVED"
        target_vio["verified_at"] = datetime.now().isoformat()
        target_vio["verified_by"] = current_user["email"]
    elif action_upper == "REJECT":
        new_status = "REQUIRES_CHANGES"
        if not req.comment or not req.comment.strip():
            raise HTTPException(status_code=400, detail="Reviewer comment is required when requesting changes.")
    elif action_upper == "REOPEN":
        new_status = "REOPENED"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}. Must be APPROVE, REJECT, or REOPEN.")
        
    validate_transition(old_status, new_status)
    
    if req.comment:
        target_vio["reviewer_comments"] = req.comment
        
    target_vio["status"] = new_status
    target_vio["updated_at"] = datetime.now().isoformat()
    
    update_violation_in_history(violation_id, target_vio)
    
    act_id = f"ACT-{str(uuid.uuid4())[:8]}"
    activity = {
        "activity_id": act_id,
        "violation_id": violation_id,
        "actor_id": current_user["email"],
        "actor_name": current_user["name"],
        "actor_role": current_user["role"],
        "action": f"VERIFIED_{new_status}" if new_status == "RESOLVED" else f"REVIEWED_{new_status}",
        "previous_status": old_status,
        "new_status": new_status,
        "comment": req.comment or f"HR Reviewer resolved the issue.",
        "evidence_url": target_vio.get("mitigation_evidence_url"),
        "created_at": datetime.now().isoformat()
    }
    save_activity(activity)
    
    return {"status": "success", "violation": target_vio}

@app.get("/api/violations/{violation_id}/activity")
def get_violation_activity(violation_id: str, current_user: dict = Depends(get_current_user)):
    all_vios = get_all_violations_flat()
    target_vio = None
    for audit_id, vio in all_vios:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    if current_user["role"] == "EMPLOYEE" and target_vio.get("assigned_employee_id") != current_user["employee_id"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this violation.")
        
    activities = get_activities()
    filtered_act = [act for act in activities if act.get("violation_id") == violation_id]
    filtered_act.sort(key=lambda x: x.get("created_at", ""))
    return filtered_act


# =====================================================================
# --- AUDIT-DEFENSIBLE ELECTRONIC POLICY ACKNOWLEDGMENT FEATURE ---
# =====================================================================

POLICIES_FILE = "policies.json"
ACK_FILE = "acknowledgments.json"
POLICY_AUDIT_FILE = "policy_audit_trail.json"

class PolicyModel(BaseModel):
    policy_id: str
    title: str
    version: str
    effective_date: str
    acknowledgment_due_date: str
    document_url: str
    document_sha256: str
    is_active: bool = True
    created_at: str
    content: str

class AcknowledgmentModel(BaseModel):
    acknowledgment_id: str
    policy_id: str
    policy_version: str
    policy_document_sha256: str
    employee_id: str
    employee_name: str
    employee_email: str
    department: str
    signature_type: str = "TYPED_NAME"
    typed_signature: str
    electronic_consent: bool
    acknowledged_reading: bool
    signed_at: str
    signed_ip_address: str
    user_agent: str
    authentication_method: str = "JWT_LOGIN"
    status: str = "SIGNED"
    receipt_hash: str

class AuditEventModel(BaseModel):
    event_id: str
    acknowledgment_id: str | None = None
    actor_id: str
    action: str
    policy_version: str
    document_sha256: str
    server_timestamp: str
    source_ip: str
    user_agent: str

class AcknowledgeRequest(BaseModel):
    typed_signature: str
    electronic_consent: bool
    acknowledged_reading: bool

def get_policies():
    if not os.path.exists(POLICIES_FILE):
        return []
    try:
        with open(POLICIES_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_policies(policies):
    with open(POLICIES_FILE, "w") as f:
        json.dump(policies, f, indent=2)

def get_acknowledgments():
    if not os.path.exists(ACK_FILE):
        return []
    try:
        with open(ACK_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_acknowledgments(acks):
    with open(ACK_FILE, "w") as f:
        json.dump(acks, f, indent=2)

def get_policy_audit_trail():
    if not os.path.exists(POLICY_AUDIT_FILE):
        return []
    try:
        with open(POLICY_AUDIT_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_policy_audit_trail(trail):
    with open(POLICY_AUDIT_FILE, "w") as f:
        json.dump(trail, f, indent=2)

def log_audit_event(actor_id: str, action: str, policy_version: str, document_sha256: str, source_ip: str, user_agent: str, acknowledgment_id: str = None):
    trail = get_policy_audit_trail()
    event = {
        "event_id": f"EVT-{str(uuid.uuid4())[:8].upper()}",
        "acknowledgment_id": acknowledgment_id,
        "actor_id": actor_id,
        "action": action,
        "policy_version": policy_version,
        "document_sha256": document_sha256,
        "server_timestamp": datetime.utcnow().isoformat() + "Z",
        "source_ip": source_ip,
        "user_agent": user_agent
    }
    trail.append(event)
    save_policy_audit_trail(trail)

def mask_ip(ip: str) -> str:
    if not ip:
        return ""
    if ":" in ip:
        parts = ip.split(":")
        if len(parts) > 1:
            return ":".join(parts[:-1]) + ":xxxx"
        return "xxxx"
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.{parts[2]}.xxx"
    return "xxx.xxx.xxx.xxx"

MOCK_EMPLOYEES = [
    {"employee_id": "EMP-3430", "name": "Ross", "email": "employee.ross@security-hq.com", "department": "IT Ops"},
    {"employee_id": "EMP-1002", "name": "Auditor", "email": "auditor.compliance@firm-wide.com", "department": "HR"},
    {"employee_id": "EMP-8822", "name": "John Doe", "email": "john.doe@security-hq.com", "department": "Finance"},
    {"employee_id": "EMP-4109", "name": "Alice Cooper", "email": "alice.cooper@security-hq.com", "department": "Sales"}
]

def seed_policies_if_empty():
    policies = get_policies()
    if not policies:
        policies = [
            {
                "policy_id": "POL-DPP-001",
                "title": "Corporate Data Privacy Pledge",
                "version": "DPP-2026-v2.1",
                "effective_date": "2026-08-01",
                "acknowledgment_due_date": "2026-08-31",
                "document_url": "/uploads/policies/data-privacy-pledge-v2.1.pdf",
                "document_sha256": "sha256-dfa89104b2b291c104e12c1b2c34d38e2194fbe9426ba29283e390c918a28741",
                "is_active": True,
                "created_at": "2026-08-01T00:00:00Z",
                "content": """# Corporate Data Privacy Pledge (v2.1)

## 1. Overview and Purpose
This document outlines the strict guidelines governing the storage, usage, and sharing of personal identifiable information (PII) at Security-HQ. Every employee handling user information must pledge to protect it according to our standards.

## 2. Customer Trust & Security
We collect information only for lawful and system-functional requirements. Data must never be downloaded to unencrypted local machines or shared via unauthorized channels.

## 3. Mandatory Protocols
- **Data Minimization:** Only request the specific properties necessary to perform user actions.
- **Session Control:** Ensure terminal screens are locked automatically after 5 minutes of idle time.
- **Secure Transport:** Ensure TLS 1.3 is forced for all API requests transmitting confidential payloads.

## 4. Enforcement and Violations
Breaches will lead to automatic system revocation, security investigation, and potential contract termination. Thank you for your commitment to client privacy and organizational integrity.
"""
            },
            {
                "policy_id": "POL-AUP-002",
                "title": "Acceptable Use Policy",
                "version": "AUP-2026-v1.0",
                "effective_date": "2026-08-10",
                "acknowledgment_due_date": "2026-08-15",
                "document_url": "/uploads/policies/acceptable-use-policy-v1.0.pdf",
                "document_sha256": "sha256-b0e77d2d3a3f5f3e5b38d38e2194fbe9426ba29283e390c918a28741b0e77d2d",
                "is_active": True,
                "created_at": "2026-08-10T00:00:00Z",
                "content": """# Acceptable Use Policy (v1.0)

## 1. Introduction
The systems, networks, and computing devices provided by Security-HQ are intended for business operations. Unauthorized utilization of these assets is prohibited.

## 2. Prohibited Behaviors
- Storing unencrypted credentials in public github commits.
- Accessing peer assets without authorized role elevation.
- Running heavy data scraping scripts that block production networks.

## 3. Safe Usage
Employees must report potential breaches to security-alerts@security-hq.com immediately. System audits are conducted weekly to verify configuration adherence.
"""
            }
        ]
        save_policies(policies)

    acks = get_acknowledgments()
    if not acks:
        acks = [
            {
                "acknowledgment_id": "ACK-2026-0001",
                "policy_id": "POL-DPP-001",
                "policy_version": "DPP-2026-v2.1",
                "policy_document_sha256": "sha256-dfa89104b2b291c104e12c1b2c34d38e2194fbe9426ba29283e390c918a28741",
                "employee_id": "EMP-1002",
                "employee_name": "Auditor",
                "employee_email": "auditor.compliance@firm-wide.com",
                "department": "HR",
                "signature_type": "TYPED_NAME",
                "typed_signature": "Auditor",
                "electronic_consent": True,
                "acknowledged_reading": True,
                "signed_at": "2026-08-15T12:00:00Z",
                "signed_ip_address": "203.0.113.123",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "authentication_method": "JWT_LOGIN",
                "status": "SIGNED",
                "receipt_hash": "6b2a0c4f8e5b41094da98305ab2f4b0ea9d8df2e194fbe9426ba29283e390d23"
            },
            {
                "acknowledgment_id": "ACK-2026-0002",
                "policy_id": "POL-AUP-002",
                "policy_version": "AUP-2026-v1.0",
                "policy_document_sha256": "sha256-b0e77d2d3a3f5f3e5b38d38e2194fbe9426ba29283e390c918a28741b0e77d2d",
                "employee_id": "EMP-3430",
                "employee_name": "Ross",
                "employee_email": "employee.ross@security-hq.com",
                "department": "IT Ops",
                "signature_type": "TYPED_NAME",
                "typed_signature": "Ross",
                "electronic_consent": True,
                "acknowledged_reading": True,
                "signed_at": "2026-08-12T14:30:00Z",
                "signed_ip_address": "203.0.113.88",
                "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "authentication_method": "JWT_LOGIN",
                "status": "SIGNED",
                "receipt_hash": "ab83c1b0c95029a8f28d841b9426210f81d9f041b0e77d2d2a9f3b392a0149ff"
            }
        ]
        save_acknowledgments(acks)

    trail = get_policy_audit_trail()
    if not trail:
        trail = [
            {
                "event_id": "EVT-MOCK-1",
                "acknowledgment_id": "ACK-2026-0001",
                "actor_id": "auditor.compliance@firm-wide.com",
                "action": "POLICY_SIGNED",
                "policy_version": "DPP-2026-v2.1",
                "document_sha256": "sha256-dfa89104b2b291c104e12c1b2c34d38e2194fbe9426ba29283e390c918a28741",
                "server_timestamp": "2026-08-15T12:00:00Z",
                "source_ip": "203.0.113.123",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            {
                "event_id": "EVT-MOCK-2",
                "acknowledgment_id": "ACK-2026-0002",
                "actor_id": "employee.ross@security-hq.com",
                "action": "POLICY_SIGNED",
                "policy_version": "AUP-2026-v1.0",
                "document_sha256": "sha256-b0e77d2d3a3f5f3e5b38d38e2194fbe9426ba29283e390c918a28741b0e77d2d",
                "server_timestamp": "2026-08-12T14:30:00Z",
                "source_ip": "203.0.113.88",
                "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
            }
        ]
        save_policy_audit_trail(trail)

@app.get("/api/policies/assigned-to-me")
def get_assigned_policies(current_user: dict = Depends(get_current_user)):
    policies = get_policies()
    acks = get_acknowledgments()
    
    log_audit_event(
        actor_id=current_user["email"],
        action="POLICIES_LIST_VIEWED",
        policy_version="ALL",
        document_sha256="N/A",
        source_ip="203.0.113.xxx",
        user_agent="System"
    )
    
    assigned = []
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    for pol in policies:
        if not pol.get("is_active", True):
            continue
            
        emp_ack = None
        for ack in acks:
            if (ack.get("employee_email") == current_user["email"] and 
                ack.get("policy_id") == pol["policy_id"] and 
                ack.get("policy_version") == pol["version"]):
                emp_ack = ack
                break
                
        status = "SIGNED" if emp_ack else ("OVERDUE" if pol["acknowledgment_due_date"] < today_str else "PENDING")
        
        assigned.append({
            "policy_id": pol["policy_id"],
            "title": pol["title"],
            "version": pol["version"],
            "effective_date": pol["effective_date"],
            "acknowledgment_due_date": pol["acknowledgment_due_date"],
            "document_url": pol["document_url"],
            "document_sha256": pol["document_sha256"],
            "is_active": pol["is_active"],
            "created_at": pol["created_at"],
            "content": pol["content"],
            "status": status,
            "acknowledgment_id": emp_ack.get("acknowledgment_id") if emp_ack else None,
            "signed_at": emp_ack.get("signed_at") if emp_ack else None
        })
        
    return assigned

@app.get("/api/policies/{policy_id}")
def get_policy_detail(policy_id: str, current_user: dict = Depends(get_current_user)):
    policies = get_policies()
    for pol in policies:
        if pol["policy_id"] == policy_id:
            log_audit_event(
                actor_id=current_user["email"],
                action="POLICY_VIEWED",
                policy_version=pol["version"],
                document_sha256=pol["document_sha256"],
                source_ip="203.0.113.xxx",
                user_agent="System"
            )
            return pol
    raise HTTPException(status_code=404, detail="Policy not found")

@app.post("/api/policies/{policy_id}/acknowledge")
def acknowledge_policy(policy_id: str, req_body: AcknowledgeRequest, request: Request, current_user: dict = Depends(get_current_user)):
    policies = get_policies()
    target_policy = None
    for pol in policies:
        if pol["policy_id"] == policy_id and pol.get("is_active", True):
            target_policy = pol
            break
            
    if not target_policy:
        raise HTTPException(status_code=404, detail="Active policy not found")
        
    expected_name = current_user["name"].lower()
    signed_name = req_body.typed_signature.strip().lower()
    if expected_name != signed_name:
        raise HTTPException(status_code=400, detail=f"Signature verification failed. Typed signature must match your name '{current_user['name']}' exactly.")
        
    if not req_body.electronic_consent:
        raise HTTPException(status_code=400, detail="You must consent to electronic records and signatures.")
        
    if not req_body.acknowledged_reading:
        raise HTTPException(status_code=400, detail="You must confirm you have read and understood the policy.")
        
    acks = get_acknowledgments()
    for ack in acks:
        if (ack.get("employee_email") == current_user["email"] and 
            ack.get("policy_id") == policy_id and 
            ack.get("policy_version") == target_policy["version"]):
            raise HTTPException(status_code=400, detail="You have already signed this version of the policy.")
            
    client_ip = request.client.host if request.client else "127.0.0.1"
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0].strip()
        
    user_agent = request.headers.get("user-agent", "Unknown Browser")
    signed_at = datetime.utcnow().isoformat() + "Z"
    
    ack_id = f"ACK-2026-{str(uuid.uuid4())[:8].upper()}"
    
    data_to_hash = f"{ack_id}|{current_user['employee_id']}|{policy_id}|{target_policy['version']}|{signed_at}|{client_ip}"
    receipt_hash = hashlib.sha256(data_to_hash.encode()).hexdigest()
    
    ack = {
        "acknowledgment_id": ack_id,
        "policy_id": policy_id,
        "policy_version": target_policy["version"],
        "policy_document_sha256": target_policy["document_sha256"],
        "employee_id": current_user["employee_id"],
        "employee_name": current_user["name"],
        "employee_email": current_user["email"],
        "department": current_user.get("department", "IT Ops"),
        "signature_type": "TYPED_NAME",
        "typed_signature": req_body.typed_signature,
        "electronic_consent": True,
        "acknowledged_reading": True,
        "signed_at": signed_at,
        "signed_ip_address": client_ip,
        "user_agent": user_agent,
        "authentication_method": "JWT_LOGIN",
        "status": "SIGNED",
        "receipt_hash": receipt_hash
    }
    
    acks.append(ack)
    save_acknowledgments(acks)
    
    log_audit_event(
        acknowledgment_id=ack_id,
        actor_id=current_user["email"],
        action="POLICY_SIGNED",
        policy_version=target_policy["version"],
        document_sha256=target_policy["document_sha256"],
        source_ip=client_ip,
        user_agent=user_agent
    )
    
    ack_copy = dict(ack)
    ack_copy["signed_ip_address"] = mask_ip(client_ip)
    
    return ack_copy

@app.get("/api/acknowledgments/me")
def get_my_acknowledgments(current_user: dict = Depends(get_current_user)):
    acks = get_acknowledgments()
    my_acks = [ack for ack in acks if ack.get("employee_email") == current_user["email"]]
    
    res = []
    for ack in my_acks:
        copy_ack = dict(ack)
        copy_ack["signed_ip_address"] = mask_ip(copy_ack.get("signed_ip_address"))
        res.append(copy_ack)
    return res

@app.get("/api/acknowledgments/{acknowledgment_id}/receipt")
def get_receipt(acknowledgment_id: str, current_user: dict = Depends(get_current_user)):
    acks = get_acknowledgments()
    target_ack = None
    for ack in acks:
        if ack.get("acknowledgment_id") == acknowledgment_id:
            target_ack = ack
            break
            
    if not target_ack:
        raise HTTPException(status_code=404, detail="Acknowledgment receipt not found")
        
    is_hr = current_user["role"] == "HR"
    is_owner = target_ack.get("employee_email") == current_user["email"]
    
    if not is_hr and not is_owner:
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view this receipt.")
        
    log_audit_event(
        acknowledgment_id=acknowledgment_id,
        actor_id=current_user["email"],
        action="RECEIPT_DOWNLOADED",
        policy_version=target_ack["policy_version"],
        document_sha256=target_ack["policy_document_sha256"],
        source_ip="203.0.113.xxx",
        user_agent="System"
    )
    
    copy_ack = dict(target_ack)
    if not is_hr:
        copy_ack["signed_ip_address"] = mask_ip(copy_ack.get("signed_ip_address"))
        
    return copy_ack

@app.get("/api/hr/acknowledgments")
def get_hr_acknowledgments(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR role required")
        
    policies = get_policies()
    acks = get_acknowledgments()
    
    results = []
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    for emp in MOCK_EMPLOYEES:
        for pol in policies:
            if not pol.get("is_active", True):
                continue
                
            emp_ack = None
            for ack in acks:
                if (ack.get("employee_email") == emp["email"] and 
                    ack.get("policy_id") == pol["policy_id"] and 
                    ack.get("policy_version") == pol["version"]):
                    emp_ack = ack
                    break
                    
            if emp_ack:
                results.append({
                    "acknowledgment_id": emp_ack["acknowledgment_id"],
                    "policy_id": pol["policy_id"],
                    "policy_title": pol["title"],
                    "policy_version": pol["version"],
                    "employee_id": emp["employee_id"],
                    "employee_name": emp["name"],
                    "employee_email": emp["email"],
                    "department": emp["department"],
                    "status": "SIGNED",
                    "signed_at": emp_ack["signed_at"],
                    "signed_ip_address": emp_ack["signed_ip_address"]
                })
            else:
                status = "OVERDUE" if pol["acknowledgment_due_date"] < today_str else "PENDING"
                results.append({
                    "acknowledgment_id": None,
                    "policy_id": pol["policy_id"],
                    "policy_title": pol["title"],
                    "policy_version": pol["version"],
                    "employee_id": emp["employee_id"],
                    "employee_name": emp["name"],
                    "employee_email": emp["email"],
                    "department": emp["department"],
                    "status": status,
                    "signed_at": None,
                    "signed_ip_address": None
                })
                
    return results

@app.get("/api/hr/acknowledgments/{acknowledgment_id}")
def get_hr_acknowledgment_detail(acknowledgment_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR role required")
        
    acks = get_acknowledgments()
    target_ack = None
    for ack in acks:
        if ack.get("acknowledgment_id") == acknowledgment_id:
            target_ack = ack
            break
            
    if not target_ack:
        raise HTTPException(status_code=404, detail="Acknowledgment not found")
        
    return target_ack

@app.post("/api/hr/policies/{policy_id}/send-reminders")
def send_reminders(policy_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR role required")
        
    policies = get_policies()
    target_policy = None
    for pol in policies:
        if pol["policy_id"] == policy_id:
            target_policy = pol
            break
            
    if not target_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    log_audit_event(
        actor_id=current_user["email"],
        action="REMINDER_SENT",
        policy_version=target_policy["version"],
        document_sha256=target_policy["document_sha256"],
        source_ip="203.0.113.xxx",
        user_agent="System"
    )
    
    return {"status": "success", "message": f"Reminders sent successfully for {target_policy['title']}!"}

# ==========================================
# SLA ESCALATION AUTOMATION FEATURE
# ==========================================
import uuid

SLA_SETTINGS_FILE = "sla_settings.json"
NOTIF_FILE = "escalation_notifications.json"

DEFAULT_SLA_SETTINGS = {
    "rules": {
        "CRITICAL": {
            "acknowledgment_limit_hours": 1.0,
            "resolution_limit_hours": 24.0,
            "escalation_recipient_email": "it.lead@company.com",
            "escalation_recipient_name": "IT Manager"
        },
        "HIGH": {
            "acknowledgment_limit_hours": 4.0,
            "resolution_limit_hours": 48.0,
            "escalation_recipient_email": "it.lead@company.com",
            "escalation_recipient_name": "IT Manager"
        },
        "MEDIUM": {
            "acknowledgment_limit_hours": 0.0,
            "resolution_limit_hours": 168.0,
            "escalation_recipient_email": "compliance.director@company.com",
            "escalation_recipient_name": "Compliance Director"
        },
        "LOW": {
            "acknowledgment_limit_hours": 0.0,
            "resolution_limit_hours": 336.0,
            "escalation_recipient_email": "compliance.director@company.com",
            "escalation_recipient_name": "Compliance Director"
        }
    },
    "use_short_demo_durations": False
}

def get_sla_settings():
    if not os.path.exists(SLA_SETTINGS_FILE):
        return DEFAULT_SLA_SETTINGS
    try:
        with open(SLA_SETTINGS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_SLA_SETTINGS

def save_sla_settings(settings):
    with open(SLA_SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)

def get_notifications():
    if not os.path.exists(NOTIF_FILE):
        return []
    try:
        with open(NOTIF_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_notifications(notifs):
    with open(NOTIF_FILE, "w") as f:
        json.dump(notifs, f, indent=2)

class SLARuleModel(BaseModel):
    acknowledgment_limit_hours: float
    resolution_limit_hours: float
    escalation_recipient_email: str
    escalation_recipient_name: str

class SLASettingsUpdate(BaseModel):
    rules: dict[str, SLARuleModel]
    use_short_demo_durations: bool

class NotificationEventModel(BaseModel):
    notification_id: str
    violation_id: str
    event_type: str
    recipient_name: str
    recipient_email: str
    channel: str = "MOCK_EMAIL"
    status: str = "SENT"
    message: str
    created_at: str

class ManualEscalateRequest(BaseModel):
    comment: str | None = None

def calculate_sla_deadlines(violation: dict, created_at_dt: datetime = None):
    if not created_at_dt:
        created_at_str = violation.get("created_at") or datetime.utcnow().isoformat()
        if created_at_str.endswith("Z"):
            created_at_str = created_at_str[:-1]
        try:
            created_at_dt = datetime.fromisoformat(created_at_str)
        except Exception:
            created_at_dt = datetime.utcnow()
            
    severity = (violation.get("severity") or "Medium").upper()
    settings = get_sla_settings()
    rule = settings["rules"].get(severity, settings["rules"]["MEDIUM"])
    
    use_demo = settings.get("use_short_demo_durations", False)
    
    if use_demo:
        if severity == "CRITICAL":
            ack_delta = timedelta(minutes=0.5)
            res_delta = timedelta(minutes=2)
        elif severity == "HIGH":
            ack_delta = timedelta(minutes=1)
            res_delta = timedelta(minutes=5)
        else:
            ack_delta = timedelta(minutes=10)
            res_delta = timedelta(minutes=30)
    else:
        ack_delta = timedelta(hours=rule["acknowledgment_limit_hours"])
        res_delta = timedelta(hours=rule["resolution_limit_hours"])
        
    ack_due = (created_at_dt + ack_delta).isoformat() + "Z" if rule["acknowledgment_limit_hours"] > 0 or use_demo else None
    res_due = (created_at_dt + res_delta).isoformat() + "Z"
    
    return ack_due, res_due

def calculate_sla_status_and_metrics(violation: dict, now_utc: datetime):
    sla = violation.get("sla", {})
    if not sla:
        return {}
        
    status = (violation.get("status") or "OPEN").upper()
    sla_status = sla.get("sla_status", "ON_TRACK")
    
    if sla_status == "PAUSED":
        return sla
        
    if status == "RESOLVED":
        sla["sla_status"] = "RESOLVED"
        sla["time_remaining_seconds"] = 0
        return sla
        
    created_at_str = violation.get("created_at") or now_utc.isoformat()
    if created_at_str.endswith("Z"):
        created_at_str = created_at_str[:-1]
    created_at_dt = datetime.fromisoformat(created_at_str)
    
    res_due_str = sla.get("resolution_due_at")
    if res_due_str.endswith("Z"):
        res_due_str = res_due_str[:-1]
    res_due_dt = datetime.fromisoformat(res_due_str)
    
    total_duration_sec = (res_due_dt - created_at_dt).total_seconds()
    elapsed_sec = (now_utc - created_at_dt).total_seconds()
    
    percent_elapsed = 0.0
    if total_duration_sec > 0:
        percent_elapsed = min(100.0, max(0.0, (elapsed_sec / total_duration_sec) * 100))
        
    time_remaining = max(0, int((res_due_dt - now_utc).total_seconds()))
    
    sla["sla_percent_elapsed"] = int(percent_elapsed)
    sla["time_remaining_seconds"] = time_remaining
    
    new_sla_status = "ON_TRACK"
    
    severity = (violation.get("severity") or "Medium").upper()
    if severity in ["CRITICAL", "HIGH"] and not sla.get("acknowledged_at"):
        ack_due_str = sla.get("acknowledgment_due_at")
        if ack_due_str:
            if ack_due_str.endswith("Z"):
                ack_due_str = ack_due_str[:-1]
            ack_due_dt = datetime.fromisoformat(ack_due_str)
            if now_utc > ack_due_dt:
                new_sla_status = "ACKNOWLEDGMENT_OVERDUE"
                
    if new_sla_status != "ACKNOWLEDGMENT_OVERDUE":
        if now_utc >= res_due_dt:
            new_sla_status = "BREACHED"
        elif percent_elapsed >= 80.0:
            new_sla_status = "WARNING_80"
        elif percent_elapsed >= 50.0:
            new_sla_status = "WARNING_50"
            
    if sla.get("escalation_level", 0) > 0:
        new_sla_status = "ESCALATED"
        
    sla["sla_status"] = new_sla_status
    return sla

def build_notification_message(violation: dict, event_type: str) -> str:
    vio_id = violation.get("id")
    severity = (violation.get("severity") or "Medium").upper()
    rule = violation.get("rule_violated")
    emp_name = violation.get("assigned_to", {}).get("name", "Employee")
    dept = violation.get("assigned_to", {}).get("department", "IT")
    sla = violation.get("sla", {})
    deadline = sla.get("resolution_due_at", "")
    
    if event_type == "SLA_WARNING_50":
        return f"SLA Reminder: 50% of the resolution deadline for Critical/High finding {vio_id} ({rule}) has elapsed. Responsible: {emp_name} ({dept}). Target resolution is {deadline}."
    elif event_type == "SLA_WARNING_80":
        return f"SLA Warning: 80% of the resolution deadline for Critical/High finding {vio_id} ({rule}) has elapsed. Immediate attention is required. Target resolution is {deadline}."
    elif event_type == "SLA_ACK_OVERDUE":
        return f"SLA Breach: Acknowledgment deadline for high-severity violation {vio_id} ({rule}) has passed. Employee: {emp_name} has not signed or acknowledged the task yet."
    elif event_type == "SLA_BREACHED":
        return f"SLA BREACHED: Violation {vio_id} ({rule}) has missed its resolution SLA. Severity: {severity}. Responsible employee {emp_name} ({dept}) has been escalated to Level 1. Department Lead notified."
    elif event_type == "SLA_ESCALATED_L2":
        return f"CRITICAL ESCALATION (Level 2): Unresolved violation {vio_id} ({rule}) remains breached 24 hours after SLA expiration. Escalating to Compliance Director for immediate review."
    return f"SLA Alert: Policy violation alert for {vio_id}."

def create_notification_event(violation_id: str, event_type: str, recipient_name: str, recipient_email: str, message: str, now_utc: datetime):
    notifs = get_notifications()
    notif_id = f"NOTIF-{str(uuid.uuid4())[:8].upper()}"
    notif = {
        "notification_id": notif_id,
        "violation_id": violation_id,
        "event_type": event_type,
        "recipient_name": recipient_name,
        "recipient_email": recipient_email,
        "channel": "MOCK_EMAIL",
        "status": "SENT",
        "message": message,
        "created_at": now_utc.isoformat() + "Z"
    }
    notifs.append(notif)
    save_notifications(notifs)

def check_and_process_slas(now_utc: datetime):
    history = get_history()
    updated = False
    
    for audit in history:
        for vio in audit.get("violations", []):
            if vio.get("status") == "RESOLVED":
                continue
                
            if "sla" not in vio:
                ack_due, res_due = calculate_sla_deadlines(vio)
                vio["sla"] = {
                    "acknowledgment_due_at": ack_due,
                    "resolution_due_at": res_due,
                    "acknowledged_at": None,
                    "resolved_at": None,
                    "sla_status": "ON_TRACK",
                    "sla_percent_elapsed": 0,
                    "time_remaining_seconds": 86400,
                    "warning_50_sent": False,
                    "warning_80_sent": False,
                    "breach_notification_sent": False,
                    "escalation_level": 0,
                    "last_escalated_at": None
                }
                
            if "assigned_to" not in vio:
                vio["assigned_to"] = {
                    "employee_id": "EMP-3430",
                    "name": "Ross",
                    "email": "employee.ross@security-hq.com",
                    "department": "IT Ops",
                    "department_lead_name": "IT Manager",
                    "department_lead_email": "manager@example.com"
                }
                
            vio["sla"] = calculate_sla_status_and_metrics(vio, now_utc)
            sla = vio["sla"]
            
            if sla.get("sla_status") in ["PAUSED", "RESOLVED"]:
                continue
                
            severity = (vio.get("severity") or "Medium").upper()
            if severity in ["CRITICAL", "HIGH"] and not sla.get("acknowledged_at"):
                ack_due_str = sla.get("acknowledgment_due_at")
                if ack_due_str:
                    if ack_due_str.endswith("Z"):
                        ack_due_str = ack_due_str[:-1]
                    ack_due_dt = datetime.fromisoformat(ack_due_str)
                    if now_utc > ack_due_dt and not sla.get("warning_ack_sent", False):
                        msg = build_notification_message(vio, "SLA_ACK_OVERDUE")
                        create_notification_event(vio["id"], "SLA_ACK_OVERDUE", vio["assigned_to"]["name"], vio["assigned_to"]["email"], msg, now_utc)
                        create_notification_event(vio["id"], "SLA_ACK_OVERDUE", "HR Compliance Team", "auditor.compliance@firm-wide.com", msg, now_utc)
                        create_notification_event(vio["id"], "SLA_ACK_OVERDUE", vio["assigned_to"]["department_lead_name"], vio["assigned_to"]["department_lead_email"], msg, now_utc)
                        
                        sla["warning_ack_sent"] = True
                        sla["sla_status"] = "ACKNOWLEDGMENT_OVERDUE"
                        updated = True
                        
            if sla.get("sla_percent_elapsed", 0) >= 50 and not sla.get("warning_50_sent", False):
                msg = build_notification_message(vio, "SLA_WARNING_50")
                create_notification_event(vio["id"], "SLA_WARNING_50", vio["assigned_to"]["name"], vio["assigned_to"]["email"], msg, now_utc)
                
                sla["warning_50_sent"] = True
                updated = True
                
            if sla.get("sla_percent_elapsed", 0) >= 80 and not sla.get("warning_80_sent", False):
                msg = build_notification_message(vio, "SLA_WARNING_80")
                create_notification_event(vio["id"], "SLA_WARNING_80", vio["assigned_to"]["name"], vio["assigned_to"]["email"], msg, now_utc)
                create_notification_event(vio["id"], "SLA_WARNING_80", "HR Compliance Team", "auditor.compliance@firm-wide.com", msg, now_utc)
                
                sla["warning_80_sent"] = True
                updated = True
                
            res_due_str = sla.get("resolution_due_at")
            if res_due_str:
                if res_due_str.endswith("Z"):
                    res_due_str = res_due_str[:-1]
                res_due_dt = datetime.fromisoformat(res_due_str)
                
                if now_utc >= res_due_dt:
                    if not sla.get("breach_notification_sent", False):
                        msg = build_notification_message(vio, "SLA_BREACHED")
                        create_notification_event(vio["id"], "SLA_BREACHED", "HR Compliance Team", "auditor.compliance@firm-wide.com", msg, now_utc)
                        create_notification_event(vio["id"], "SLA_BREACHED", vio["assigned_to"]["department_lead_name"], vio["assigned_to"]["department_lead_email"], msg, now_utc)
                        
                        sla["breach_notification_sent"] = True
                        sla["escalation_level"] = 1
                        sla["last_escalated_at"] = now_utc.isoformat() + "Z"
                        sla["sla_status"] = "ESCALATED"
                        updated = True
                        
                    last_esc_str = sla.get("last_escalated_at")
                    if last_esc_str and sla.get("escalation_level", 0) == 1:
                        if last_esc_str.endswith("Z"):
                            last_esc_str = last_esc_str[:-1]
                        last_esc_dt = datetime.fromisoformat(last_esc_str)
                        
                        settings = get_sla_settings()
                        use_demo = settings.get("use_short_demo_durations", False)
                        esc_delay = timedelta(minutes=2) if use_demo else timedelta(hours=24)
                        
                        if now_utc >= last_esc_dt + esc_delay:
                            msg = build_notification_message(vio, "SLA_ESCALATED_L2")
                            create_notification_event(vio["id"], "SLA_ESCALATED_L2", "Compliance Director", "compliance.director@company.com", msg, now_utc)
                            
                            sla["escalation_level"] = 2
                            sla["last_escalated_at"] = now_utc.isoformat() + "Z"
                            updated = True
                            
            updated = True
            
    if updated:
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=4)



@app.get("/api/violations/{violation_id}/sla")
def get_violation_sla(violation_id: str, current_user: dict = Depends(get_current_user)):
    violations_flat = get_all_violations_flat()
    target_vio = None
    for _, vio in violations_flat:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    if current_user["role"] != "HR" and target_vio.get("assigned_to", {}).get("email") != current_user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    now_utc = datetime.utcnow()
    if "sla" in target_vio:
        target_vio["sla"] = calculate_sla_status_and_metrics(target_vio, now_utc)
        
    return target_vio.get("sla", {})

@app.get("/api/violations/{violation_id}/escalations")
def get_violation_escalations(violation_id: str, current_user: dict = Depends(get_current_user)):
    notifs = get_notifications()
    vio_notifs = [n for n in notifs if n.get("violation_id") == violation_id]
    return sorted(vio_notifs, key=lambda x: x.get("created_at", ""))

@app.post("/api/hr/violations/{violation_id}/acknowledge")
def acknowledge_sla_violation(violation_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR permissions required")
        
    violations_flat = get_all_violations_flat()
    target_vio = None
    for _, vio in violations_flat:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    sla = target_vio.get("sla", {})
    if not sla:
        raise HTTPException(status_code=400, detail="SLA tracking not initialized for this violation")
        
    now_str = datetime.utcnow().isoformat() + "Z"
    sla["acknowledged_at"] = now_str
    sla["sla_status"] = "ON_TRACK"
    
    update_violation_in_history(violation_id, target_vio)
    
    log_activity_event(
        violation_id=violation_id,
        actor_name=current_user["name"],
        actor_role=current_user["role"],
        action="SLA_ACKNOWLEDGED",
        comment="SLA acknowledgment registered by HR."
    )
    
    return {"status": "success", "message": "Violation SLA acknowledged successfully.", "acknowledged_at": now_str}

@app.post("/api/hr/violations/{violation_id}/pause-sla")
def pause_sla(violation_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR permissions required")
        
    violations_flat = get_all_violations_flat()
    target_vio = None
    for _, vio in violations_flat:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    sla = target_vio.get("sla", {})
    if not sla:
        raise HTTPException(status_code=400, detail="SLA tracking not initialized")
        
    now_utc = datetime.utcnow()
    sla["sla_status"] = "PAUSED"
    sla["paused_at"] = now_utc.isoformat() + "Z"
    
    update_violation_in_history(violation_id, target_vio)
    
    log_activity_event(
        violation_id=violation_id,
        actor_name=current_user["name"],
        actor_role=current_user["role"],
        action="SLA_PAUSED",
        comment="Remediation SLA paused by HR reviewer."
    )
    
    return {"status": "success", "message": "SLA paused."}

@app.post("/api/hr/violations/{violation_id}/resume-sla")
def resume_sla(violation_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR permissions required")
        
    violations_flat = get_all_violations_flat()
    target_vio = None
    for _, vio in violations_flat:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    sla = target_vio.get("sla", {})
    if not sla or sla.get("sla_status") != "PAUSED":
        raise HTTPException(status_code=400, detail="SLA is not paused")
        
    now_utc = datetime.utcnow()
    paused_at_str = sla.get("paused_at")
    if paused_at_str:
        if paused_at_str.endswith("Z"): paused_at_str = paused_at_str[:-1]
        paused_at_dt = datetime.fromisoformat(paused_at_str)
        paused_delta = now_utc - paused_at_dt
        
        for key in ["acknowledgment_due_at", "resolution_due_at"]:
            due_str = sla.get(key)
            if due_str:
                if due_str.endswith("Z"): due_str = due_str[:-1]
                due_dt = datetime.fromisoformat(due_str)
                sla[key] = (due_dt + paused_delta).isoformat() + "Z"
                
    sla["sla_status"] = "ON_TRACK"
    sla["paused_at"] = None
    
    update_violation_in_history(violation_id, target_vio)
    
    log_activity_event(
        violation_id=violation_id,
        actor_name=current_user["name"],
        actor_role=current_user["role"],
        action="SLA_RESUMED",
        comment="Remediation SLA resumed. Deadlines adjusted accordingly."
    )
    
    return {"status": "success", "message": "SLA resumed."}

@app.post("/api/hr/violations/{violation_id}/manual-escalate")
def manual_escalate(violation_id: str, req: ManualEscalateRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR permissions required")
        
    violations_flat = get_all_violations_flat()
    target_vio = None
    for _, vio in violations_flat:
        if vio.get("id") == violation_id:
            target_vio = vio
            break
            
    if not target_vio:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    sla = target_vio.get("sla", {})
    if not sla:
        raise HTTPException(status_code=400, detail="SLA tracking not initialized")
        
    now_utc = datetime.utcnow()
    new_level = sla.get("escalation_level", 0) + 1
    sla["escalation_level"] = new_level
    sla["last_escalated_at"] = now_utc.isoformat() + "Z"
    sla["sla_status"] = "ESCALATED"
    
    update_violation_in_history(violation_id, target_vio)
    
    comment_text = req.comment or f"Manual escalation triggered to level {new_level} by compliance."
    
    lead_name = target_vio.get("assigned_to", {}).get("department_lead_name", "Department Lead")
    lead_email = target_vio.get("assigned_to", {}).get("department_lead_email", "lead@company.com")
    
    msg = f"MANUAL CRITICAL ESCALATION (Level {new_level}): Violation {violation_id} has been manually escalated by HR Reviewer. Review details: {comment_text}"
    create_notification_event(violation_id, "MANUAL_ESCALATION", lead_name, lead_email, msg, now_utc)
    
    log_activity_event(
        violation_id=violation_id,
        actor_name=current_user["name"],
        actor_role=current_user["role"],
        action="MANUAL_ESCALATION",
        comment=comment_text
    )
    
    return {"status": "success", "message": f"Violation escalated to Level {new_level}."}

@app.get("/api/hr/sla-settings")
def get_sla_settings_endpoint(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR permissions required")
    return get_sla_settings()

@app.patch("/api/hr/sla-settings")
def update_sla_settings_endpoint(settings_update: SLASettingsUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR permissions required")
        
    new_settings = settings_update.dict()
    save_sla_settings(new_settings)
    
    history = get_history()
    now_utc = datetime.utcnow()
    
    for audit in history:
        for vio in audit.get("violations", []):
            if vio.get("status") == "RESOLVED":
                continue
            if "sla" in vio:
                ack_due, res_due = calculate_sla_deadlines(vio)
                vio["sla"]["acknowledgment_due_at"] = ack_due
                vio["sla"]["resolution_due_at"] = res_due
                vio["sla"] = calculate_sla_status_and_metrics(vio, now_utc)
                
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)
        
    return new_settings

@app.post("/api/hr/run-sla-check")
def run_sla_check_endpoint(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "HR":
        raise HTTPException(status_code=403, detail="HR permissions required")
    now_utc = datetime.utcnow()
    check_and_process_slas(now_utc)
    return {"status": "success", "message": "Manual SLA evaluation checker run completed successfully."}

def log_activity_event(violation_id: str, actor_name: str, actor_role: str, action: str, comment: str):
    activity_file = "activity.json"
    activities = []
    if os.path.exists(activity_file):
        try:
            with open(activity_file, "r") as f:
                activities = json.load(f)
        except Exception:
            pass
            
    new_act = {
        "activity_id": f"ACT-{str(uuid.uuid4())[:8].upper()}",
        "violation_id": violation_id,
        "actor_id": actor_name,
        "actor_name": actor_name,
        "actor_role": actor_role,
        "action": action,
        "previous_status": "OPEN",
        "new_status": "OPEN",
        "comment": comment,
        "evidence_url": None,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    activities.append(new_act)
    with open(activity_file, "w") as f:
        json.dump(activities, f, indent=4)