import os
import json
import io
import pandas as pd
from pypdf import PdfReader
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
load_dotenv()
SENDER_EMAIL = "company.auditor.bot@gmail.com" 
MANAGER_EMAIL = "manager@example.com"

app = FastAPI(title="Compliance Auditor AI API")

# Enable CORS for React Frontend (runs on localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def send_violation_alert(rule, severity, log_evidence):
    """
    Mock function to simulate sending an email alert to the manager.
    """
    try:
        subject = f"🚨 URGENT: {severity} Policy Violation Detected"
        body = f"""
        Enterprise AI Auditor has detected a new policy violation.
        
        Severity: {severity}
        Rule Violated: {rule}
        Log Evidence: {log_evidence}
        
        Please log in to the dashboard immediately to review the recommended action.
        """
        
        # We are commenting out the actual sending logic for local testing
        # server = smtplib.SMTP('smtp.gmail.com', 587)
        # server.starttls()
        # server.login(SENDER_EMAIL, "your-app-password")
        # server.send_message(msg)
        # server.quit()
        
        print("\n" + "="*50)
        print(f"✅ [MOCK EMAIL SENT TO {MANAGER_EMAIL}]")
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

@app.post("/api/audit")
async def execute_audit(
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

        Return your response ONLY as valid JSON (no markdown block formatting, no extra text) with this structure:
        {{
            "violations": [
                {{
                    "id": 1,
                    "rule_violated": "Name/Summary of policy rule",
                    "log_entry": "Exact log line or evidence snippet",
                    "severity": "HIGH" | "MEDIUM" | "LOW",
                    "explanation": "Detailed explanation of why this violates policy",
                    "recommendation": "Actionable steps to resolve or mitigate"
                }}
            ]
        }}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        audit_result = json.loads(cleaned_text)

        # --- EMAIL ALERT LOGIC ---
        # Extract the violations list safely
        violations = audit_result.get("violations", [])
        
        # Loop through and trigger alerts for HIGH severity
        for violation in violations:
            if violation.get("severity", "").upper() == "HIGH":
                send_violation_alert(
                    rule=violation.get("rule_violated", "Unknown Rule"),
                    severity="HIGH",
                    log_evidence=violation.get("log_entry", "See Dashboard for details")
                )

        return audit_result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audit execution failed: {str(e)}"
        )