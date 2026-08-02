import os
import json
import io
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from pypdf import PdfReader
from fastapi import FastAPI, UploadFile, File, HTTPException, status
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

# --- STRICT PYDANTIC SCHEMAS FOR GEMINI STRUCTURED OUTPUT ---
class Violation(BaseModel):
    id: int
    rule_violated: str = Field(description="Summary of policy rule violated")
    log_entry: str = Field(description="Exact log entry evidence")
    severity: str = Field(description="Must be HIGH, MEDIUM, or LOW")
    explanation: str = Field(description="Concise 1-sentence explanation")
    recommendation: str = Field(description="Concise 1-sentence mitigation recommendation")

class AuditResponse(BaseModel):
    violations: list[Violation]


def send_violation_alert(rule, severity, log_evidence):
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
        for page in pdf_reader.pages[:5]:  # Limit to first 5 pages
            text += page.extract_text() or ""
        return text.strip()
        
    elif filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
        # Strictly truncate CSV to top 30 rows
        if len(df) > 30:
            df = df.head(30)
        return df.to_string()
        
    elif filename.endswith((".txt", ".json", ".log")):
        text = content.decode("utf-8", errors="ignore").strip()
        # Truncate text logs to 8,000 chars max
        return text[:8000]
        
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

INSTRUCTIONS:
- Identify NO MORE THAN 5-8 most critical violations to prevent token overflow.
- Keep explanation and recommendation brief (1 short sentence each).
"""

        # 3. Call Gemini API using strict Pydantic response_schema
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AuditResponse,  # <--- Forces schema matching
                temperature=0.1
            )
        )

        # 4. Safely parse structured JSON
        raw_text = response.text or ""
        clean_text = raw_text.strip().replace("```json", "").replace("```", "")
        
        if not clean_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gemini returned an empty response. Try uploading a smaller or simpler file."
            )

        audit_results = json.loads(clean_text)

        # 5. Email Alert Trigger Logic
        violations = audit_results.get("violations", [])
        for violation in violations:
            if str(violation.get("severity", "")).upper() == "HIGH":
                send_violation_alert(
                    rule=violation.get("rule_violated", "Unknown Rule"),
                    severity="HIGH",
                    log_evidence=violation.get("log_entry", "See Dashboard for details")
                )

        return audit_results

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