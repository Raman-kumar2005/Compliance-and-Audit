import os
import io
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import pandas as pd
from google import genai
from google.genai import types

app = FastAPI(title="Compliance & Audit AI Backend")

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_policy_text(file_bytes: bytes, filename: str) -> str:
    try:
        if filename.lower().endswith('.pdf'):
            pdf_reader = PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text.strip()
        else:
            return file_bytes.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing policy file: {str(e)}")

def extract_log_text(file_bytes: bytes, filename: str) -> str:
    try:
        if filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_bytes))
            return df.to_csv(index=False)
        else:
            return file_bytes.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing log file: {str(e)}")

@app.get("/")
def health_check():
    return {"status": "online", "message": "Compliance Auditor AI API is active!"}

@app.post("/api/audit")
async def execute_audit(
    policy_file: UploadFile = File(...),
    log_file: UploadFile = File(...)
):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GEMINI_API_KEY environment variable is not set."
        )

    policy_bytes = await policy_file.read()
    log_bytes = await log_file.read()

    policy_content = extract_policy_text(policy_bytes, policy_file.filename)
    log_content = extract_log_text(log_bytes, log_file.filename)

    system_instruction = """
    You are the core intelligence engine for the Enterprise AI Compliance & Risk Auditor. Your objective is to ingest company policy rules and system execution logs, perform strict cross-examination, and output structured, actionable compliance violation reports.

    EVALUATION RULES:
    1. Strict Fact-Based Cross-Examination: Only flag a violation if the log entry explicitly breaches a documented policy parameter. Do not hallucinate unstated policies.
    2. Severity Tiering:
       - HIGH: Security breaches, unauthorized data exports, privilege escalation, or financial threshold violations.
       - MEDIUM: Operational hours violations, missing manager sign-offs, or unfulfilled mandatory L&D retakes.
       - LOW: Minor procedural deviations, late log syncing, or non-critical documentation gaps.
    3. Actionable Guidance: Provide immediate, enforceable remediation steps for every flagged item.

    OUTPUT FORMAT:
    You MUST respond strictly in valid JSON matching this schema:
    {
      "total_logs_analyzed": number,
      "total_violations": number,
      "high_severity_count": number,
      "medium_severity_count": number,
      "low_severity_count": number,
      "violations": [
        {
          "id": number,
          "rule_violated": "Policy rule title",
          "log_entry": "Raw log line or record parameters",
          "severity": "HIGH" | "MEDIUM" | "LOW",
          "explanation": "Clear reason for breach",
          "recommendation": "Enforceable remediation action"
        }
      ]
    }
    """

    user_prompt = f"""
    POLICY DOCUMENT:
    {policy_content}

    SYSTEM LOGS:
    {log_content}
    """

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(
            status_code=Status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini AI processing error: {str(e)}"
        )