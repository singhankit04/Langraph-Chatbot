# 🧠 EideticAI — Enterprise Agentic RAG & Knowledge Platform

EideticAI is an enterprise-grade AI knowledge management and search platform. Built with **LangGraph**, **Next.js 16**, **Express**, and **Qdrant Vector DB**, EideticAI combines **Agentic RAG**, persistent multi-turn session memory via **LangGraph MemorySaver**, and an automated **multi-provider LLM fallback chain** (Groq → Google Gemini → OpenRouter).

---

## 🔄 Request & Response Flow

EideticAI follows a streamlined request-response architecture. User requests are handled through the frontend, processed by the Express backend, and orchestrated by the LangGraph agent to intelligently retrieve context, query vector storage, or search the web before responding.

```mermaid
flowchart TD
    subgraph ClientLayer["🖥️ Frontend Client"]
        User(["👤 User"])
        UI["Chat Interface (Next.js 16)"]
    end

    subgraph ServerLayer["⚙️ Backend API"]
        API["Express Server (:5000)"]
    end

    subgraph AgentLayer["🧠 AI Agent Workflow (LangGraph)"]
        Agent["AI Agent Router"]
        Memory[("Session Memory")]
        VectorDB[("Qdrant Vector DB")]
        WebSearch["Tavily Web Search"]
        LLM["LLM Fallback Chain<br/>(Groq / Gemini / OpenRouter)"]
    end

    %% 1. Request Flow
    User -->|"1. Submits prompt or PDF"| UI
    UI -->|"2. Sends API request"| API
    API -->|"3. Dispatches message with Session ID"| Agent

    %% 2. Context & Tool Retrieval
    Agent -->|"Load session history"| Memory
    Agent -->|"Retrieve document chunks (RAG)"| VectorDB
    Agent -->|"Fetch live data"| WebSearch
    Agent -->|"Prompt + retrieved context"| LLM
    LLM -->|"Return generated answer"| Agent

    %% 3. Response Flow
    Agent -->|"4. Return response with citations"| API
    API -->|"5. Send JSON response"| UI
    UI -->|"6. Render answer & sources"| User
```

---

## ⚡ Agentic Decision Workflow

Instead of running an expensive vector search on every question, the AI agent dynamically inspects user intent and decides whether to query uploaded documents, search the live web, or respond directly from memory.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant UI as Frontend (Next.js)
    participant API as Backend (Express)
    participant Agent as AI Agent (LangGraph)
    participant Services as Memory & Vector Store
    participant LLM as LLM (Groq / Gemini)

    User->>UI: Submits question or uploads PDF
    UI->>API: HTTP Request with Session ID
    API->>Agent: Process message
    Agent->>Services: Load conversation history

    alt General Conversation
        Agent->>LLM: Send query and chat history
        LLM-->>Agent: Direct answer
    else Uploaded Document Query (RAG)
        Agent->>Services: Search matching document chunks
        Services-->>Agent: Relevant text chunks & page numbers
        Agent->>LLM: Synthesize grounded response
        LLM-->>Agent: Answer with citations
    else Live Web Search
        Agent->>LLM: Perform web search for current information
        LLM-->>Agent: Real-time answer
    end

    Agent-->>API: Formatted response with citations
    API-->>UI: JSON Response
    UI-->>User: Render formatted answer & source links
```

---

## 🧠 Session Memory (`MemorySaver`) Flow

Conversations maintain seamless context across turns using **LangGraph MemorySaver**:

1. **Frontend Generates Random UUID:** A `crypto.randomUUID()` is generated on the client and associated with the chat session.
2. **Passed to Backend:** Passed via URL parameter (`/api/chat/:conversationId`), JSON body (`conversationId`), or HTTP header (`x-conversation-id`).
3. **Thread ID Isolation:** LangGraph checkpointer stores the message history strictly partitioned by `thread_id`:
   ```javascript
   await chatbotApp.invoke(
     { messages: [new HumanMessage(question)] },
     { configurable: { thread_id: conversationId } }
   );
   ```
4. **Follow-Up Inferences:** Subsequent questions (e.g., *"What was the second point in that summary?"*) retrieve the checkpointed state without re-uploading documents or re-prompting context.
5. **Thread Reset:** Call `DELETE /api/chat/:conversationId` to purge the thread checkpoint from memory.

---

## 📡 API Routes Reference

Base URL (Local): `http://localhost:5000` (or `/api/*` via Next.js proxy)

| Method | Endpoint | Description | Key Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Service root status | None |
| `GET` | `/api/health` | Healthcheck & system uptime | None |
| `POST` | `/api/chat/:conversationId` | Send user message to a conversation thread | URL: `conversationId`<br>Body: `{ message: string }` |
| `POST` | `/api/chat` | Fallback chat endpoint (accepts ID in body) | Body: `{ message: string, conversationId?: string }` |
| `GET` | `/api/chat/:conversationId/history` | Retrieve full message history from MemorySaver | URL: `conversationId` |
| `DELETE`| `/api/chat/:conversationId` | Clear session checkpoint from MemorySaver | URL: `conversationId` |
| `POST` | `/api/chat/:conversationId/upload` | Upload & chunk PDF into Qdrant for this thread | Form-data: `pdf` file |
| `POST` | `/api/upload-pdf` | Backwards-compatibility upload fallback | Form-data: `pdf` file |

### Route Details & Payload Examples

#### 1. Post Chat Message
```http
POST /api/chat/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "message": "What is the liability limitation in section 4 of the contract?"
}
```
**Response (200 OK):**
```json
{
  "answer": "According to Section 4 of the uploaded contract, liability is capped at $500,000...",
  "sources": [
    {
      "source": "master_agreement.pdf",
      "page": 4
    }
  ],
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "chatId": "550e8400-e29b-41d4-a716-446655440000",
  "threadId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 2. Get Thread History
```http
GET /api/chat/550e8400-e29b-41d4-a716-446655440000/history
```
**Response (200 OK):**
```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "messages": [
    { "role": "human", "content": "Hello!" },
    { "role": "ai", "content": "Hello! I am EideticAI, how can I assist you today?" }
  ],
  "total": 2
}
```

#### 3. Clear Conversation Thread
```http
DELETE /api/chat/550e8400-e29b-41d4-a716-446655440000
```
**Response (200 OK):**
```json
{
  "message": "Memory checkpoint deleted for conversationId / thread_id \"550e8400-e29b-41d4-a716-446655440000\".",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 4. Upload & Index PDF
```http
POST /api/chat/550e8400-e29b-41d4-a716-446655440000/upload
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="pdf"; filename="contract.pdf"
Content-Type: application/pdf

[BINARY DATA]
------WebKitFormBoundary--
```
**Response (200 OK):**
```json
{
  "message": "Successfully indexed \"contract.pdf\" for conversation!",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "contract.pdf",
  "pagesCount": 12,
  "chunksCount": 38
}
```

---

## 🛠️ Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Agent & Workflow** | [LangGraph](https://langchain-ai.github.io/langgraphjs/) | StateGraph orchestration, conditional routing, tool execution |
| **Session Memory** | `MemorySaver` | Thread-isolated in-memory checkpointing per conversation |
| **Vector Database** | [Qdrant Cloud](https://qdrant.tech/) | Vector storage, payload filtering on `metadata.conversationId` |
| **Embeddings** | `@langchain/google-genai` | `text-embedding-004` (768 dimensions) |
| **Primary LLM** | `@langchain/groq` | `openai/gpt-oss-120b` (Ultra fast response) |
| **Fallback LLMs** | Google Gemini & OpenRouter | `gemini-2.5-flash` and `nvidia/nemotron-3.5-lightning` |
| **Live Web Search** | `@langchain/tavily` | Tavily Search API for real-time fact retrieval |
| **Backend Server** | Express 5 / Node.js ESM | REST API, Multer upload handling, CORS |
| **Frontend Web** | Next.js 16 (App Router) + React 19 | Responsive UI, dynamic radar animations, modal inspectors |
| **Styling** | Vanilla CSS + Tailwind v4 | Glassmorphism, curated palette, dark mode |

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/<your-username>/eideticai.git
cd eideticai

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

#### Backend (`backend/.env`)
```env
# Primary & Fallback LLM Providers
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-or-v1-...

# Tavily Web Search
TAVILY_API_KEY=tvly-...

# Qdrant Vector Cloud
QDRANT_URL=https://<your-cluster>.qdrant.io
QDRANT_API_KEY=...
QDRANT_COLLECTION=rag_documents

# Redis (Message Broker)
REDIS_URL=redis://...

# Allowed Frontend Origins (CORS)
FRONTEND_URL=http://localhost:3000,https://eideticai.vercel.app/
PORT=5000
```

#### Frontend (`frontend/.env`)
```env
# Backend API Base URL (Proxied via next.config.mjs rewrites)
BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

### 3. Run Development Servers

In terminal 1 (Backend):
```bash
cd backend
npm run dev
```

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📄 License

ISC License. Built with ❤️ for enterprise AI knowledge management.
