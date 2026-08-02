import os
import json
import io
import uuid
from datetime import datetime
import pandas as pd
from pypdf import PdfReader
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from google import genai

app = FastAPI(title="Compliance Auditor AI API")

# Enable CORS for React Frontend (runs on localhost:5173)
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
    history.insert(0, record) # Prepend so newest is first
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)

def extract_text_from_file(file: UploadFile) -> str:
    content = file.file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        pdf_reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages[:10]:  # Limit to first 10 pages if large
            text += page.extract_text() or ""
        return text.strip()
        
    elif filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
        # Truncate CSV to top 100 rows to stay well within free tier token limits
        if len(df) > 100:
            df = df.head(100)
        return df.to_string()
        
    elif filename.endswith((".txt", ".json", ".log")):
        text = content.decode("utf-8", errors="ignore").strip()
        # Truncate long text logs to ~15,000 characters
        return text[:15000]
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format: {file.filename}"
        )

@app.get("/")
def read_root():
    return {"status": "online", "message": "Compliance Auditor AI API is active!"}

@app.get("/api/history")
def get_audit_history():
    return get_history()

@app.post("/api/audit")
def execute_audit(
    policy_file: UploadFile = File(...),
    log_file: UploadFile = File(...)
):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GEMINI_API_KEY environment variable is missing."
        )

    try:
        policy_text = extract_text_from_file(policy_file)
        log_text = extract_text_from_file(log_file)
        
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        You are an expert IT Compliance and Security Auditor. 
        Compare the following Company Policy Document with the System Logs File.
        Identify any violations, policy breaches, or anomalies present in the logs.

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

        Return your response ONLY as valid JSON (no markdown block formatting, no extra text) with this structure:
        {{
            "metrics": {{
                "compliance_score": 84,
                "risk_distribution": {{ "Low": 2, "Medium": 1, "High": 0, "Critical": 0 }},
                "violations_by_department": {{ "Finance": 1, "HR": 0, "IT": 2, "Sales": 0, "Ops": 0 }},
                "compliance_trend": [71, 74, 76, 79, 81, 84]
            }},
            "violations": [
                {{
                    "id": 1,
                    "employee": "charlie",
                    "department": "IT",
                    "rule_violated": "Name/Summary of policy rule",
                    "log_entry": "Exact log line or evidence snippet",
                    "severity": "Critical",
                    "explanation": "Detailed explanation of why this violates policy",
                    "recommendation": "Actionable steps to resolve or mitigate"
                }}
            ]
        }}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        audit_result = json.loads(cleaned_text)
        
        # Add metadata and save to history
        record_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        audit_record = {
            "id": record_id,
            "timestamp": timestamp,
            "policy_filename": policy_file.filename,
            "log_filename": log_file.filename,
            "metrics": audit_result.get("metrics", {}),
            "violations": audit_result.get("violations", [])
        }
        
        save_to_history(audit_record)
        return audit_record

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audit execution failed: {str(e)}"
        )