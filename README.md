# Enterprise AI Compliance Auditor

Instant policy violation detection & automated log risk analysis powered by FastAPI & Gemini AI.

---

## 🏗️ System Architecture & End-to-End Workflow

```mermaid
flowchart TD
    User([User / Security Auditor]) --> Frontend["React Frontend Dashboard"]

    subgraph CLIENT ["Client Side (React + Vite + Tailwind CSS)"]
        Frontend --> Action{Select Action}
        Action -- "Upload Policy File" --> PolicyUp["Policy Document Upload (.pdf, .txt)"]
        Action -- "Upload Log Records" --> LogUp["System Logs Upload (.csv, .json, .txt)"]
        Action -- "Quick Demo" --> DemoData["Load Demo Preview Data"]
    end

    subgraph BACKEND ["Server Side (FastAPI + Python + Uvicorn)"]
        PolicyUp --> API["FastAPI Backend Endpoint (/api/audit)"]
        LogUp --> API
        DemoData --> Mocks["MOCK_RESULTS Payload"]

        API --> Extract["extract_text_from_file()"]
        
        subgraph PARSERS ["Data Extraction & Truncation Layer"]
            Extract --> PyPDF["PyPDF Reader (PDF Text Extraction)"]
            Extract --> Pandas["Pandas Dataframe (CSV Reader & Sampler)"]
            Extract --> UTFDecoder["UTF-8 Decoder (.txt / .json Logs)"]
        end

        PyPDF --> Truncate["Data Truncator / Token Limit Manager"]
        Pandas --> Truncate
        UTFDecoder --> Truncate

        Truncate --> PromptEng["Audit Prompt Constructor"]
    end

    subgraph AI_ENGINE ["LLM Engine (Google Gemini API)"]
        PromptEng --> Gemini["Gemini API (gemini-2.5-flash)"]
        Gemini --> Analysis{"Policy Violation Detected?"}

        Analysis -- "Yes" --> FlagViolation["Create Violation Record"]
        FlagViolation --> Explain["Generate Evidence Explanation & Recommendation"]
        
        Analysis -- "No" --> MarkClean["Mark Logs as Fully Compliant"]
    end

    subgraph SCORING ["Risk Assessment & Scoring Engine"]
        Explain --> RiskEngine["Calculate Risk Metrics"]
        MarkClean --> RiskEngine

        RiskEngine --> HighRisk["Count High Severity Breaches"]
        RiskEngine --> TotalFlags["Aggregate Total Flags Detected"]
        RiskEngine --> Status["Assign Overall Compliance Status"]
    end

    subgraph DASHBOARD ["UI Results & Analytics Dashboard"]
        HighRisk --> RenderUI["Render Interactive Dashboard Cards"]
        TotalFlags --> RenderUI
        Status --> RenderUI
        Mocks --> RenderUI

        RenderUI --> Metrics["Summary Metrics Cards"]
        RenderUI --> ViolationTable["Detailed Violation & Evidence Table"]
        RenderUI --> CleanState["Clean Compliance State Banner"]
    end

    Metrics --> User
    ViolationTable --> User
    CleanState --> User
```

---

## 🚀 Tech Stack Breakdown

* **Frontend:** React, Vite, Tailwind CSS, Lucide Icons, Axios
* **Backend:** Python, FastAPI, Uvicorn, PyPDF, Pandas
* **AI Engine:** Google Gemini API (`gemini-2.5-flash`)
