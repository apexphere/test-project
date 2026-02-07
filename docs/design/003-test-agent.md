# Design Document: Test Agent (AI Auto-Heal)

| Field | Value |
|-------|-------|
| **Author** | Riley (BA/Architect) |
| **Created** | 2026-02-07 |
| **Status** | 🔶 Draft |
| **Issue** | #34 |

---

## 1. Overview

### 1.1 Problem Statement

Test suites at scale suffer from:

- **Flaky tests** that pass and fail randomly, eroding trust
- **Repeated manual investigation** of the same failure patterns
- **Slow remediation** — issues sit in backlogs while tests stay broken
- **Alert fatigue** — teams ignore failures because "it's probably flaky"

The test-reporter service now captures historical test data. But data without action is just noise. We need an intelligent agent that can:

1. Detect problematic tests automatically
2. Analyze failure patterns using AI
3. Take appropriate action (retry, quarantine, escalate)
4. Learn from outcomes to improve over time

### 1.2 Goals

1. **Detect** flaky and failing tests automatically from test-reporter data
2. **Analyze** failure patterns using LLM to identify root causes
3. **Act** intelligently: retry, quarantine, create issues, notify
4. **Prevent** bad actions: no infinite loops, no masking real bugs
5. **Integrate** with existing CI/CD and test-reporter workflows

### 1.3 Non-Goals

- Auto-generating test code (that's a developer task)
- Replacing human judgment on complex failures
- Running tests directly (test-automation handles that)
- Real-time test interception (batch analysis only)
- Supporting non-Playwright frameworks initially

---

## 2. Concepts

### 2.1 What is "Auto-Heal"?

Auto-heal doesn't mean the agent fixes code. It means the agent takes intelligent actions to:

| Symptom | Auto-Heal Action |
|---------|------------------|
| Test flaky (intermittent pass/fail) | Quarantine test, create issue |
| Test timing out | Suggest timeout increase, retry with extended time |
| Same error pattern repeating | Group failures, single issue with analysis |
| Environment issue detected | Retry, notify ops team |
| New regression detected | Fast-track to developers |

### 2.2 Agent vs. Automation

| Concern | test-automation | test-agent |
|---------|-----------------|------------|
| Runs tests | ✅ | ❌ |
| Reports results | ✅ (via reporter) | ❌ |
| Analyzes trends | ❌ | ✅ |
| Decides actions | ❌ | ✅ |
| Uses AI/LLM | ❌ | ✅ |

---

## 3. Trigger Model

### 3.1 Trigger Types

The agent runs in response to events, not continuously:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Trigger Sources                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Webhook    │  │   Schedule   │  │      Manual CLI          │  │
│  │  (CI event)  │  │  (cron job)  │  │  (developer request)     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                       │                 │
│         └────────────────┼───────────────────────┘                 │
│                          │                                          │
│                          ▼                                          │
│                  ┌───────────────┐                                  │
│                  │  test-agent   │                                  │
│                  │   service     │                                  │
│                  └───────────────┘                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

| Trigger | When | Use Case |
|---------|------|----------|
| **Post-Run Webhook** | After each CI test run | Immediate analysis of new failures |
| **Scheduled Scan** | Every N hours (configurable) | Trend analysis, flakiness detection |
| **Manual Invoke** | Developer CLI/API call | Investigate specific test on demand |
| **Threshold Alert** | Flakiness > X%, Pass rate < Y% | Proactive issue creation |

### 3.2 Trigger Payloads

**Webhook (from CI):**
```json
{
  "trigger": "post_run",
  "runId": "abc-123",
  "source": "ci",
  "branch": "develop",
  "commitSha": "def456",
  "hasFailed": true
}
```

**Scheduled:**
```json
{
  "trigger": "scheduled",
  "scope": "full_analysis",
  "lookbackDays": 7
}
```

**Manual:**
```json
{
  "trigger": "manual",
  "scope": "single_test",
  "testId": "auth/login.spec.ts:should login successfully"
}
```

---

## 4. Action Model

### 4.1 Available Actions

| Action | Description | Automated? | Reversible? |
|--------|-------------|------------|-------------|
| **Retry** | Re-run specific test with modifications | ✅ | ✅ |
| **Quarantine** | Mark test as skipped (with label) | ⚠️ Needs approval | ✅ |
| **Create Issue** | Open GitHub issue with analysis | ✅ | ✅ |
| **Update Issue** | Add info to existing issue | ✅ | ✅ |
| **Notify** | Send alert to Slack/Discord/email | ✅ | N/A |
| **Suggest Fix** | Generate fix suggestion in issue/PR | ✅ | N/A |
| **No Action** | Log analysis, take no action | ✅ | N/A |

### 4.2 Action Decision Tree

```
                    ┌─────────────────────┐
                    │   Test Failed?      │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
              No    │                     │    Yes
         ┌──────────┤   Check History     ├──────────┐
         │          │                     │          │
         ▼          └─────────────────────┘          ▼
   ┌───────────┐                            ┌───────────────┐
   │  Healthy  │                            │ First Failure?│
   │ No Action │                            └───────┬───────┘
   └───────────┘                                    │
                                    ┌───────────────┼───────────────┐
                                    │ Yes           │               │ No
                                    ▼               ▼               ▼
                            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                            │  New Issue  │ │ Flaky Test? │ │ Repeat Fail │
                            │  Log only   │ │ (score>0.3) │ │ (3+ times)  │
                            └─────────────┘ └──────┬──────┘ └──────┬──────┘
                                                   │               │
                                        ┌──────────▼──────┐        │
                                        │  Quarantine +   │        │
                                        │  Create Issue   │        │
                                        └─────────────────┘        │
                                                                   │
                                        ┌──────────────────────────┘
                                        ▼
                            ┌───────────────────────┐
                            │  Analyze with LLM     │
                            │  Create/Update Issue  │
                            │  Notify Team          │
                            └───────────────────────┘
```

### 4.3 Quarantine Mechanics

Quarantine is the most impactful action — it removes a test from the suite. Safety rails:

1. **Never auto-quarantine without approval** (configurable)
2. **Max quarantine duration**: 7 days default, then auto-reminder
3. **Quarantine file**: `test-automation/quarantine.json`
4. **Labels**: Tests run with `@quarantine` tag are skipped

```json
// quarantine.json
{
  "quarantined": [
    {
      "testId": "auth/login.spec.ts:should login with 2FA",
      "reason": "Flaky: 45% flakiness score over 20 runs",
      "quarantinedAt": "2026-02-07T10:00:00Z",
      "expiresAt": "2026-02-14T10:00:00Z",
      "issueUrl": "https://github.com/org/repo/issues/42",
      "quarantinedBy": "test-agent"
    }
  ]
}
```

**Playwright integration:**
```typescript
// playwright.config.ts
import quarantine from './quarantine.json';

const quarantinedTestIds = new Set(quarantine.quarantined.map(q => q.testId));

export default defineConfig({
  // ...
  grep: quarantinedTestIds.size > 0 
    ? new RegExp(`^(?!.*(${[...quarantinedTestIds].map(escapeRegex).join('|')})).*$`)
    : undefined,
});
```

---

## 5. AI/LLM Integration

### 5.1 LLM Use Cases

| Use Case | Input | Output |
|----------|-------|--------|
| **Failure Classification** | Error message + stack trace | Category (timeout, assertion, network, etc.) |
| **Root Cause Analysis** | Test history, error patterns | Likely cause explanation |
| **Fix Suggestion** | Error + test code + app code | Suggested code change |
| **Issue Description** | Analysis results | Human-readable issue body |
| **Deduplication** | New error + existing issues | "Same as issue #X" or "New issue" |

### 5.2 LLM Provider Strategy

```typescript
interface LLMProvider {
  analyze(prompt: string, context: AnalysisContext): Promise<AnalysisResult>;
  estimateCost(tokens: number): number;
}

// Support multiple providers, configurable
const providers = {
  openai: new OpenAIProvider({ model: 'gpt-4o' }),
  anthropic: new AnthropicProvider({ model: 'claude-sonnet-4-20250514' }),
  local: new OllamaProvider({ model: 'llama3' }), // Cost-free fallback
};
```

### 5.3 Prompt Engineering

**Failure Analysis Prompt:**
```
You are a test failure analyst. Analyze the following test failure and provide:

1. CATEGORY: One of [timeout, assertion, network, element_not_found, race_condition, environment, unknown]
2. ROOT_CAUSE: Brief explanation of likely cause
3. FLAKINESS_LIKELY: true/false - is this likely a flaky test?
4. SUGGESTED_FIX: Concrete suggestion or "Needs human investigation"

TEST: {testId}
ERROR: {errorMessage}
STACK: {stackTrace}
HISTORY: Failed {failCount}/{totalRuns} times. Flakiness score: {flakinessScore}
RECENT_RESULTS: {last10Results}

Respond in JSON format.
```

### 5.4 Cost Management

LLM calls cost money. Strategies:

| Strategy | Implementation |
|----------|----------------|
| **Batch analysis** | Analyze multiple failures in one call |
| **Caching** | Cache analysis for same error signature |
| **Tiered models** | Use cheap model first, expensive for complex cases |
| **Token limits** | Truncate stack traces, limit context |
| **Budget caps** | Daily/monthly spend limits |

```typescript
interface CostConfig {
  dailyBudgetUsd: number;      // Default: 10
  monthlyBudgetUsd: number;    // Default: 100
  preferredProvider: string;   // Default: 'openai'
  fallbackProvider: string;    // Default: 'local'
}
```

---

## 6. Integration Architecture

### 6.1 System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         test-project ecosystem                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐         ┌─────────────────┐                    │
│  │  GitHub Actions │         │  test-reporter  │                    │
│  │                 │         │                 │                    │
│  │  ┌───────────┐  │  POST   │  ┌───────────┐  │                    │
│  │  │ Playwright├──┼────────▶│  │  /api/*   │  │                    │
│  │  │  tests    │  │  results│  │           │  │                    │
│  │  └───────────┘  │         │  └─────┬─────┘  │                    │
│  │        │        │         │        │        │                    │
│  │        │ done   │         │        │ GET    │                    │
│  │        ▼        │         │        ▼        │                    │
│  │  ┌───────────┐  │ webhook │  ┌───────────┐  │                    │
│  │  │  Notify   ├──┼────────▶│  │test-agent │  │                    │
│  │  │  agent    │  │         │  │           │  │                    │
│  │  └───────────┘  │         │  └─────┬─────┘  │                    │
│  │                 │         │        │        │                    │
│  └─────────────────┘         └────────┼────────┘                    │
│                                       │                              │
│         ┌─────────────────────────────┼─────────────────────────┐   │
│         │                             ▼                         │   │
│         │  ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │   │
│         │  │   GitHub    │◀───│  Actions    │───▶│   Slack   │ │   │
│         │  │   Issues    │    │  (agent)    │    │  Notify   │ │   │
│         │  └─────────────┘    └──────┬──────┘    └───────────┘ │   │
│         │                            │                          │   │
│         │                            ▼                          │   │
│         │                    ┌─────────────┐                    │   │
│         │                    │     LLM     │                    │   │
│         │                    │   Provider  │                    │   │
│         │                    └─────────────┘                    │   │
│         │                                                       │   │
│         └───────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 test-reporter Integration

The agent is a **consumer** of test-reporter's API:

```typescript
class TestReporterClient {
  constructor(private baseUrl: string) {}

  async getRecentRuns(limit: number = 20): Promise<Run[]> {
    return fetch(`${this.baseUrl}/api/runs?limit=${limit}`).then(r => r.json());
  }

  async getTestHistory(testId: string, limit: number = 50): Promise<TestResult[]> {
    return fetch(`${this.baseUrl}/api/tests/${encodeURIComponent(testId)}/history?limit=${limit}`)
      .then(r => r.json());
  }

  async getFlakyTests(minRuns: number = 5): Promise<FlakyTest[]> {
    return fetch(`${this.baseUrl}/api/insights/flaky?minRuns=${minRuns}`).then(r => r.json());
  }

  async getRunDetails(runId: string): Promise<RunWithResults> {
    return fetch(`${this.baseUrl}/api/runs/${runId}`).then(r => r.json());
  }
}
```

### 6.3 GitHub Integration

```typescript
class GitHubClient {
  constructor(private token: string, private repo: string) {}

  async createIssue(title: string, body: string, labels: string[]): Promise<Issue> {
    // POST /repos/{owner}/{repo}/issues
  }

  async updateIssue(issueNumber: number, body: string): Promise<void> {
    // PATCH /repos/{owner}/{repo}/issues/{issue_number}
  }

  async findExistingIssue(testId: string): Promise<Issue | null> {
    // Search for open issues with test ID in title/body
  }

  async createPRComment(prNumber: number, comment: string): Promise<void> {
    // POST /repos/{owner}/{repo}/issues/{pr}/comments
  }
}
```

---

## 7. Service Design

### 7.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Consistency with test-reporter |
| Runtime | Node.js 20 | LTS, good async support |
| Framework | Express.js or none (CLI-first) | Simple webhook receiver |
| LLM SDK | OpenAI SDK, Anthropic SDK | Official SDKs |
| GitHub | Octokit | Official GitHub SDK |
| Notifications | Slack SDK, Discord.js | Team alerts |
| Scheduling | node-cron or external (k8s CronJob) | Periodic analysis |

### 7.2 Directory Structure

```
test-agent/
├── src/
│   ├── index.ts              # Entry point (CLI + webhook server)
│   ├── config.ts             # Environment configuration
│   ├── triggers/
│   │   ├── webhook.ts        # POST /webhook handler
│   │   ├── scheduled.ts      # Cron job handler
│   │   └── manual.ts         # CLI command handler
│   ├── analysis/
│   │   ├── engine.ts         # Core analysis orchestration
│   │   ├── patterns.ts       # Error pattern detection
│   │   └── classifier.ts     # Failure classification
│   ├── actions/
│   │   ├── index.ts          # Action dispatcher
│   │   ├── quarantine.ts     # Quarantine management
│   │   ├── issue.ts          # GitHub issue creation
│   │   ├── notify.ts         # Slack/Discord notifications
│   │   └── retry.ts          # Test retry orchestration
│   ├── llm/
│   │   ├── provider.ts       # LLM abstraction
│   │   ├── openai.ts         # OpenAI implementation
│   │   ├── anthropic.ts      # Anthropic implementation
│   │   ├── local.ts          # Ollama implementation
│   │   └── prompts.ts        # Prompt templates
│   ├── clients/
│   │   ├── test-reporter.ts  # test-reporter API client
│   │   ├── github.ts         # GitHub API client
│   │   └── slack.ts          # Slack webhook client
│   └── utils/
│       ├── logger.ts         # Structured logging
│       └── cache.ts          # Analysis result caching
├── tests/
│   ├── analysis.test.ts
│   ├── actions.test.ts
│   └── llm.test.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

### 7.3 API Specification

#### Webhook Endpoint

```yaml
POST /webhook:
  description: Receive trigger from CI or external system
  request:
    content-type: application/json
    headers:
      X-Webhook-Secret: string (optional, for auth)
    body:
      trigger: "post_run" | "threshold" | "manual"
      runId: string (optional)
      testId: string (optional)
      metadata: object (optional)
  response:
    202:
      accepted: true
      jobId: string
  errors:
    400: Invalid payload
    401: Invalid webhook secret
```

#### Status Endpoint

```yaml
GET /status:
  description: Agent health check
  response:
    200:
      status: "healthy"
      lastRun: datetime
      pendingJobs: int
      llmProvider: string
```

### 7.4 CLI Commands

```bash
# Analyze a specific run
test-agent analyze --run-id abc-123

# Analyze a specific test
test-agent analyze --test-id "auth/login.spec.ts:should login"

# Full flakiness scan
test-agent scan --scope flaky --min-runs 10

# Quarantine management
test-agent quarantine list
test-agent quarantine add --test-id "..." --reason "..."
test-agent quarantine remove --test-id "..."
test-agent quarantine expire  # Remove expired quarantines

# Check LLM budget
test-agent budget status
```

---

## 8. Safety & Guardrails

### 8.1 Risk Matrix

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **False positive quarantine** | High | Medium | Require approval, auto-expire |
| **Masking real bugs** | High | Medium | Never quarantine new failures |
| **Infinite retry loops** | Medium | Low | Max 2 retries, cooldown period |
| **LLM hallucinations** | Medium | Medium | Human review of suggestions |
| **Cost overruns** | Medium | Low | Budget caps, alerts |
| **Noisy notifications** | Low | High | Rate limiting, grouping |
| **GitHub API rate limits** | Low | Low | Caching, batching |

### 8.2 Safety Rules (Hardcoded)

```typescript
const SAFETY_RULES = {
  // Never quarantine without history
  minRunsBeforeQuarantine: 10,
  
  // Never quarantine tests that just started failing
  minFailuresBeforeQuarantine: 3,
  
  // Flakiness threshold for quarantine consideration
  flakinessThresholdForQuarantine: 0.3,
  
  // Maximum quarantine duration
  maxQuarantineDays: 14,
  
  // Maximum retries per test per day
  maxRetriesPerDay: 3,
  
  // Cooldown between actions on same test
  actionCooldownMinutes: 60,
  
  // Never auto-quarantine (require approval)
  requireApprovalForQuarantine: true,
  
  // Maximum issues to create per day
  maxIssuesPerDay: 10,
  
  // Notification rate limit
  notificationCooldownMinutes: 30,
};
```

### 8.3 Approval Workflow

For high-impact actions (quarantine), the agent creates a pending action:

```
┌────────────────────────────────────────────────────────────────┐
│                    Quarantine Approval Flow                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Agent detects flaky test                                   │
│              │                                                  │
│              ▼                                                  │
│  2. Agent creates pending action                               │
│     (stored in DB or file)                                     │
│              │                                                  │
│              ▼                                                  │
│  3. Agent notifies team (Slack/GitHub issue comment)           │
│     "Test X is flaky. Quarantine? [Approve] [Reject]"          │
│              │                                                  │
│              ├──────────────────────────────────────┐          │
│              │                                      │          │
│              ▼                                      ▼          │
│  4a. Human approves                    4b. Human rejects       │
│      (via CLI or Slack button)             (or timeout)        │
│              │                                      │          │
│              ▼                                      ▼          │
│  5a. Agent quarantines test            5b. Action cancelled    │
│      Creates issue                         Logged for review   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Configuration

### 9.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_REPORTER_URL` | test-reporter API base URL | (required) |
| `GITHUB_TOKEN` | GitHub PAT for issues/PRs | (required) |
| `GITHUB_REPO` | Target repo (owner/repo) | (required) |
| `OPENAI_API_KEY` | OpenAI API key | (optional) |
| `ANTHROPIC_API_KEY` | Anthropic API key | (optional) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook | (optional) |
| `LLM_PROVIDER` | Preferred LLM (openai/anthropic/local) | `openai` |
| `LLM_DAILY_BUDGET_USD` | Daily LLM spend limit | `10` |
| `QUARANTINE_AUTO_APPROVE` | Skip approval for quarantine | `false` |
| `LOG_LEVEL` | Logging verbosity | `info` |

### 9.2 Configuration File

```yaml
# test-agent.config.yaml

triggers:
  webhook:
    enabled: true
    port: 3001
    secret: ${WEBHOOK_SECRET}
  
  scheduled:
    enabled: true
    cron: "0 */6 * * *"  # Every 6 hours
    scope: flaky
  
  thresholds:
    flakinessAlert: 0.3
    passRateAlert: 0.9

analysis:
  minRunsForAnalysis: 5
  lookbackDays: 14
  
actions:
  quarantine:
    enabled: true
    requireApproval: true
    maxDurationDays: 14
  
  issues:
    enabled: true
    labels: ["test-agent", "flaky-test"]
    assignees: []
  
  notifications:
    slack:
      enabled: true
      channel: "#test-alerts"
    
llm:
  provider: openai
  model: gpt-4o
  fallbackProvider: local
  dailyBudgetUsd: 10
  cacheTtlHours: 24
```

---

## 10. Observability

### 10.1 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agent_runs_total` | Counter | Total analysis runs |
| `agent_actions_total` | Counter | Actions taken (by type) |
| `agent_llm_calls_total` | Counter | LLM API calls |
| `agent_llm_cost_usd` | Gauge | Running LLM cost |
| `agent_quarantined_tests` | Gauge | Currently quarantined tests |
| `agent_analysis_duration_ms` | Histogram | Time per analysis |

### 10.2 Logging

Structured JSON logs for observability:

```json
{
  "timestamp": "2026-02-07T10:00:00Z",
  "level": "info",
  "event": "analysis_complete",
  "runId": "abc-123",
  "testId": "auth/login.spec.ts:should login",
  "result": {
    "classification": "timeout",
    "flakinessScore": 0.45,
    "actionTaken": "create_issue",
    "issueNumber": 42
  }
}
```

---

## 11. Implementation Plan

### Phase 1: Core Analysis Engine (Est: 4-5 hours)

1. Initialize `test-agent/` project structure
2. Implement test-reporter client
3. Build analysis engine (pattern detection, classification)
4. Add CLI for manual analysis
5. Unit tests for analysis logic

### Phase 2: Action System (Est: 4-5 hours)

1. Implement quarantine file management
2. Build GitHub issue creation/update
3. Add notification system (Slack)
4. Implement action dispatcher with safety rules
5. Tests for action logic

### Phase 3: LLM Integration (Est: 4-5 hours)

1. Build LLM provider abstraction
2. Implement OpenAI provider
3. Add prompt templates
4. Implement cost tracking and caching
5. Add fallback to local model

### Phase 4: Trigger System (Est: 3-4 hours)

1. Build webhook server
2. Implement scheduled trigger (cron)
3. Add threshold-based alerting
4. CI integration (GitHub Actions step)

### Phase 5: Approval Workflow (Est: 2-3 hours)

1. Implement pending actions storage
2. Build Slack interactive approval
3. Add CLI approval commands
4. Auto-expiry of pending actions

### Phase 6: Documentation & Polish (Est: 2-3 hours)

1. README with setup guide
2. Configuration documentation
3. Runbook for common scenarios
4. Dashboard additions to test-reporter (optional)

**Total Estimate: 19-25 hours**

---

## 12. Success Criteria

- [ ] Agent can analyze test runs and identify flaky tests
- [ ] Agent creates GitHub issues with LLM-generated analysis
- [ ] Quarantine workflow works with approval
- [ ] CI can trigger agent via webhook
- [ ] Scheduled analysis runs successfully
- [ ] LLM costs stay within budget
- [ ] No false positive quarantines in first 2 weeks
- [ ] Team receives actionable notifications
- [ ] Documentation is complete

---

## 13. Open Questions

1. **Where should the agent run?**
   - Option A: As a sidecar to test-reporter (same deployment)
   - Option B: Separate service in k8s
   - Option C: GitHub Action (ephemeral, runs on trigger)
   - **Recommendation**: Start with C (simplest), move to B if needed

2. **How to handle approval at scale?**
   - Slack buttons vs. CLI vs. GitHub issue reactions
   - Need to pick one primary mechanism

3. **Should agent have write access to test-automation repo?**
   - Required for auto-committing quarantine.json
   - Alternative: Create PR for human to merge

4. **What's the MVP LLM model?**
   - GPT-4o (expensive, accurate) vs. GPT-4o-mini (cheap, good enough?)
   - Start with mini, upgrade if analysis quality insufficient

---

## 14. Appendix

### A. Example Issue Created by Agent

```markdown
## 🤖 Flaky Test Detected: auth/login.spec.ts - should login with 2FA

**Test ID:** `auth/login.spec.ts:should login with 2FA`  
**Flakiness Score:** 0.45 (High)  
**Pass Rate:** 55% over last 20 runs  
**Status:** Quarantined

### Analysis

**Classification:** Timeout / Race Condition

**Root Cause (AI Analysis):**
The test waits for a 2FA code input field that loads asynchronously. 
The `waitForSelector` timeout of 5s is insufficient when the auth 
service is under load. The timing is inconsistent because the service 
response time varies between 1-8 seconds.

**Recent Failures:**
- Run #147 (develop): Timeout waiting for `#2fa-code-input`
- Run #145 (develop): Timeout waiting for `#2fa-code-input`  
- Run #142 (feature-x): Passed
- Run #140 (develop): Timeout waiting for `#2fa-code-input`

### Suggested Fix

```typescript
// Before
await page.waitForSelector('#2fa-code-input', { timeout: 5000 });

// After
await page.waitForSelector('#2fa-code-input', { timeout: 15000 });
// Or better: wait for network idle first
await page.waitForLoadState('networkidle');
await page.waitForSelector('#2fa-code-input');
```

### Actions Taken

- ✅ Test quarantined (expires: 2026-02-14)
- ✅ Slack notification sent to #test-alerts

---
*Generated by test-agent | [View History](link) | [Remove Quarantine](link)*
```

### B. Quarantine File Schema

```typescript
interface QuarantineEntry {
  testId: string;
  reason: string;
  classification?: string;
  flakinessScore?: number;
  quarantinedAt: string;       // ISO datetime
  expiresAt: string;           // ISO datetime
  issueUrl?: string;
  quarantinedBy: 'test-agent' | 'manual';
  approvedBy?: string;         // GitHub username
}

interface QuarantineFile {
  version: 1;
  updatedAt: string;
  quarantined: QuarantineEntry[];
}
```

### C. Error Pattern Signatures

Common patterns the agent can detect without LLM:

```typescript
const ERROR_PATTERNS = {
  timeout: /timeout|timed out|exceeded.*ms/i,
  elementNotFound: /element.*not found|no element|locator.*resolved/i,
  networkError: /net::ERR|ECONNREFUSED|fetch failed/i,
  assertionFailed: /expect.*to(Be|Have|Equal)|assertion failed/i,
  authError: /401|403|unauthorized|forbidden/i,
  serverError: /500|502|503|internal server error/i,
};
```

---

*End of Design Document*
