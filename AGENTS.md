# AGENTS.md — sfdx project root

> **Why this file exists.** This SFDX project is the working area for a
> **live demo** at the Stockholm Salesforce World Tour. The demo flow drives
> `pi` to (1) read the recent Cases and write a plan to `planning/`, then
> (2) scaffold + publish an Agentforce agent in this project. Anything in
> this file is here because we hit it during a previous demo run and don't
> want the next agent to relearn it on stage.
>
> **The presentation app's own `AGENTS.md` lives at `presentation/AGENTS.md`.**
> That one explains the Next.js rig (slides, terminal iframe, planning tab).
> This file is about the SFDX side: the org, the Apex actions, the agent.


---

## 1. Demo loop at a glance

```
Plan phase      → pi reads Cases, writes planning/case-deflection-plan.html
                  (PLAN_PROMPT in presentation/components/slides.tsx)

Build phase     → pi reads the plan and:
                    1. writes 2 stub Apex actions in force-app/main/default/classes/
                    2. deploys them
                    3. scaffolds 1 .agent bundle: ONE subagent, marked as start_agent (no router)
                    4. validates + publishes (no preview, no eval)
                  (BUILD_PROMPT in slides.tsx — see §3 for what works)

Test phase      → not built yet (see presentation/AGENTS.md §8)
```

The Build phase is the part that's tripped us up most. Everything below is
load-bearing for it.

---

## 2. Order of operations for the Build phase

This is the recipe that works. **Don't reorder it.**

1. **Read** `planning/case-deflection-plan.html` to extract: agent name,
   topic name, the 1–2 actions, and what each action takes/returns.
2. **Write** the two Apex `@InvocableMethod` classes + their `cls-meta.xml`
   under `force-app/main/default/classes/`. Stub data only — no DML, no
   SOQL.
3. **Deploy the Apex first** with
   `sf project deploy start -o my-agentforce-org -d force-app/main/default/classes/<NewClass>.cls -d ...meta.xml --json`.
   The agent's `inspect/check_targets` step (and the publish itself) will
   fail until the apex `://` targets exist in the org.
4. **Scaffold the bundle** with `agentscript_authoring verb=create`. It
   writes both the `.agent` file and a correctly-formed
   `*.bundle-meta.xml` (which already includes `<bundleType>AGENT</bundleType>`
   — don't lose that, see §4).
5. **Replace the scaffold body** with the real shape — a flat,
   **single-subagent** topology: ONE `subagent` block that calls both
   actions, and that subagent IS the `start_agent`. Do **not** add a
   separate `start_agent main:` router that delegates to a subagent;
   for this demo the topology is one agent block, period. See §4 for
   the dialect.
6. **Validate locally:** `agentscript_authoring verb=compile mode=check`,
   then `inspect mode=structure`, then
   `inspect mode=check_targets target_org=my-agentforce-org`.
7. **Publish + activate** with
   `agentscript_lifecycle action=publish agent_file=… target_org=my-agentforce-org activate=true`.

If publish returns `Error / Internal Error, try again later`, **don't keep
retrying** — it's almost always step (8) below.

---

## 3. Things that have caused 500s on publish

These are real footguns from past runs. Fix them before you ship.

### 3a. `lightning__doubleType` is broken on this org

**Symptom.** Local compile is clean, `check_targets` is clean, then
`agentscript_lifecycle action=publish` returns:

```
Publish failed (HTTP 500): {"errorCode":"Error","message":"Internal Error, try again later"}
```

**Cause.** Any action `outputs:` entry declared as

```
   creditAmountUsd: object
       complex_data_type_name: "lightning__doubleType"
```

triggers a server-side 500 with no useful error message. Apex `Decimal`
return values map cleanly to `lightning__numberType` instead.

**Fix.**

```
   creditAmountUsd: object
       complex_data_type_name: "lightning__numberType"
```

For Apex `Integer` returns use `lightning__numberType` too (or
`lightning__integerType` if you want integer semantics). String → `lightning__textType`.
Boolean → `lightning__booleanType`. Date → `lightning__dateType`.

### 3b. Avoid bare `number` in outputs blocks

`agentscript_authoring verb=compile mode=check` will warn:

> Bare numeric action I/O can fail at publish for Apex targets. Use
> object + complex_data_type_name…

Listen to this warning. Always wrap numeric outputs as
`object` + `complex_data_type_name: "lightning__numberType"` for Apex
targets.

### 3c. Bundle XML must include `<bundleType>AGENT</bundleType>`

The scaffolder gets this right. If you ever hand-roll the
`*.bundle-meta.xml`, include:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<AiAuthoringBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <bundleType>AGENT</bundleType>
    <masterLabel>…</masterLabel>
</AiAuthoringBundle>
```

Without `<bundleType>` the publish-side `AiAuthoringBundle` deploy fails
(the BotVersion still creates, but the studio falls back to the legacy
builder and you'll see a confusing warning).

---

## 4. The `.agent` dialect — what actually compiles

The dialect is **`agentforce`** (not `agentscript`). Key differences from
the older shape:

### Top-level config

Use `developer_name` + `agent_label`, **not** `agent_name`:

```
config:
    developer_name: "ProntoOrderSupport"
    agent_label: "Pronto Order Support"
    agent_type: "AgentforceEmployeeAgent"
    description: "…"
```

`agent_type: "AgentforceEmployeeAgent"` is the safe default for the demo
because it does **not** require a `default_agent_user` to be provisioned.
`AgentforceServiceAgent` would force a per-user permission set deployment
that we don't want to do mid-presentation.

### `system:` and `language:` blocks are required

```
system:
    instructions: "Short paragraph about who the agent is."
    messages:
        welcome: "Hi …"
        error:   "Sorry, …"

language:
    default_locale: "en_US"
    additional_locales: ""
    all_additional_locales: False
```

Skipping `messages:` / `language:` doesn't fail local compile but has
caused server 500s in the past.

### `subagent`, not `topic`

The old `topic X:` syntax is deprecated. Use `subagent X:`. The LSP will
warn if you use `topic`.

### Reasoning instructions need procedure (`->`) or template (`|`) form

This **does not** compile:

```
subagent foo:
    reasoning:
        instructions: "Plain string here."   # ← rejected
```

This compiles:

```
subagent foo:
    reasoning:
        instructions: ->
            | Multiline text starts here.
              Each line continues with two leading spaces under the pipe.
```

### Action targets are quoted strings

```
actions:
    get_order_status:
        target: "apex://GetOrderStatus"     # ← quoted
```

**Not** `target: apex://GetOrderStatus` (unquoted) — that's a syntax error.

Targets you'll see: `apex://ClassName`, `flow://Flow_Api_Name`,
`prompt://Prompt_Api_Name`.

### Every action with a target needs an `outputs:` block

Even if the agent never inspects the outputs, the publish step needs the
contract. Mirror your `@InvocableVariable` return fields here, including
the right `complex_data_type_name` (see §3a).

### Single-subagent topology — the subagent IS the `start_agent`

This demo deliberately avoids the `start_agent main:` + `subagent X:`
router pattern. We have **one** worker subagent and we mark it as the
start agent directly. Fewer moving parts, fewer turns to first action,
and it ships in well under 60 seconds.

**Do NOT** add a separate `start_agent main:` block that transitions to
this subagent. Just one agent block, declared with the `start_agent`
keyword. That is the whole bundle for this demo.

The shape that works (and that the demo prompt requires):

```
start_agent order_resolution:
    label: "Order Resolution"
    description: "Resolves Pronto delivery cases end to end."
    reasoning:
        instructions: ->
            | Step-by-step instructions, including which actions to call
              and exactly what HTML to emit at the end.
        actions:
            get_order_status: @actions.get_order_status
                with caseId = ...
            apply_refund_or_credit: @actions.apply_refund_or_credit
                with caseId = ...
                with customerEmail = ...
                with reason = ...

    actions:
        get_order_status:
            description: "…"
            label: "Get Order Status"
            target: "apex://GetOrderStatus"
            include_in_progress_indicator: True
            progress_indicator_message: "Looking up order…"
            inputs:
                caseId: string
                    description: "…"
                    label: "Case Id"
                    is_required: True
                    complex_data_type_name: "lightning__textType"
            outputs:
                # … one entry per @InvocableVariable on the Apex Response
```

The `with foo = ...` lines inside `reasoning.actions` are the **planner's
view** of the parameter (LLM resolves it from context). The
`inputs:` block under the action definition is the **schema**. Both are
required.

---

## 5. Apex stub action conventions

Pattern that's worked twice and we should keep:

```apex
public with sharing class GetOrderStatus {

    public class Request {
        @InvocableVariable(required=true label='Case Id') public String caseId;
        @InvocableVariable(label='Order Number')           public String orderNumber;
    }

    public class Response {
        @InvocableVariable(label='Order Number')   public String orderNumber;
        @InvocableVariable(label='Status')         public String status;
        // …one variable per output you reference in the .agent
    }

    @InvocableMethod(
        label='Get Order Status'
        description='…'
        category='Pronto Order Support'
    )
    public static List<Response> getStatus(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response res = new Response();
            res.orderNumber = String.isBlank(r.orderNumber) ? 'PR-204871' : r.orderNumber;
            res.status      = 'Delivered (with issues)';
            out.add(res);
        }
        return out;
    }
}
```

**Hard rules for stubs in this demo:**

- No DML, no SOQL writes.
- No callouts, no future, no queueable. Synchronous return.
- Hard-code returns. The whole point is "we'll fill this in later."
- Wrap inputs and outputs in `Request` / `Response` inner classes —
  Agentforce's planner expects a single-arg `List<Request>` signature.
- Match every `@InvocableVariable` on `Response` with an `outputs:` entry
  in the `.agent`. Drop one and the planner can't see it.

**`cls-meta.xml`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

Pin to `66.0` to match the project. Don't omit `cls-meta.xml`; the deploy
will reject classes without it.

### Apex string idiom that bit us

`Crypto.getRandomLong()` can return negative numbers, and
`String.valueOf(...).substring(1, 9)` blows up on short numerics. If you
need a synthetic id, do:

```apex
String rnd = String.valueOf(Math.abs(Crypto.getRandomInteger())).leftPad(8, '0');
String referenceId = 'CR-' + rnd.substring(rnd.length() - 8);
```

Better: just hard-code the reference (`'CR-12345678'`) — it's a stub.

---

## 6. The HTML reply card

The demo's storytelling beat is "the agent writes a polished card back to
the chat." The card is rendered by the **chat UI**, not by the agent's
runtime — so it must be **self-contained, inline-CSS, no external assets**.

Reference card (also embedded in the agent's reasoning instructions):

```html
<div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;
            background:#0b1220;color:#e6eefb;
            border:1px solid #1f2d4d;border-left:4px solid #00a1e0;
            border-radius:10px;padding:14px 16px;max-width:520px;">
  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;
              color:#38bdf8;font-weight:600;margin-bottom:4px;">
    Pronto Order Support
  </div>
  <div style="font-size:15px;font-weight:600;margin-bottom:8px;">
    Order [ORDER_NUMBER] — [STATUS]
  </div>
  <div style="color:#8aa0c2;font-size:12.5px;line-height:1.5;margin-bottom:10px;">
    [CUSTOMER_MESSAGE]
  </div>
  <!-- pills row, ref/email footer -->
</div>
```

Colors are the same Salesforce-blue palette as the planning report. The
agent must emit **only** the HTML — no surrounding markdown / prose / code
fences. Spell that out in the reasoning instructions or the LLM will wrap
it in `\`\`\`html` blocks.

---

## 7. Tools, in priority order

For Build-phase work, prefer the SF Pi extension tools over raw `sf`:

| Need | Tool |
|---|---|
| Scaffold a new agent bundle | `agentscript_authoring verb=create` |
| Edit the `.agent` file | direct `write` / `edit` (the LSP feedback in tool output is informative) |
| Local validate | `agentscript_authoring verb=compile mode=check` |
| Verify Apex/Flow targets exist in the org | `agentscript_authoring verb=inspect mode=check_targets target_org=…` |
| Deploy Apex | `sf project deploy start -o my-agentforce-org -d <paths>` |
| Publish + activate | `agentscript_lifecycle action=publish target_org=my-agentforce-org activate=true` |
| Find existing agents | `sf data query -o my-agentforce-org --query "SELECT DeveloperName, MasterLabel FROM BotDefinition"` (regular API; **not** `-t` — the BotDefinition object isn't on the Tooling API on this org) |
| Inspect versions | `agentscript_lifecycle action=list_versions agent_api_name=…` |

`agentscript_preview` and `agentscript_eval` are **forbidden by the build
prompt** — they belong to the Test phase. Don't run them here.

---

## 8. Common mistakes from prior demo runs

| Mistake | Symptom | Fix |
|---|---|---|
| Used `lightning__doubleType` for a Decimal output | Publish 500, no useful error | Use `lightning__numberType` (§3a) |
| Used `topic X:` instead of `subagent X:` | LSP deprecation warning, server may still publish but the structure is wrong | Use `subagent` |
| `target: apex://X` (unquoted) | Local syntax error | `target: "apex://X"` |
| `instructions: "string"` under `reasoning:` | Local syntax error | Use `instructions: ->` + `\| …` |
| Apex not yet deployed when scaffolding | `check_targets` reports unresolved Apex | Deploy Apex first, then validate |
| Forgot the `outputs:` block | LSP warns; publish might still work but planner can't read fields | Always write `outputs:` mirroring `@InvocableVariable` |
| Used `agent_name` at top of config | Compiles but the dialect prefers `developer_name` + `agent_label` | Use the modern fields |
| Created `start_agent main:` that routes to a worker subagent | Bundle compiles but adds an extra planner turn before the first action fires — blows the 60s budget | Drop the router. Mark the worker subagent itself as `start_agent` (§4) |
| Tried to make it a `AgentforceServiceAgent` | Publish blocks on missing default_agent_user / permission set | Use `AgentforceEmployeeAgent` for the demo |
| Re-ran publish after a 500 | Same 500 — the error is opaque but **not transient** | Bisect the `.agent`: half it, compile+publish each side, find the offending field (that's how we found `lightning__doubleType`) |

---

## 9. The "ship in under 60 seconds" target

The Build phase prompt is shown to a live audience while pi runs. Aim for:

- ≤ 2 LLM-driven `read` calls before writing.
- A single deploy of both Apex classes (one `sf project deploy start` with
  multiple `-d` flags).
- A single `agentscript_lifecycle action=publish ... activate=true`.
- One final summary line. **No prose recap.** The audience is reading the
  agent definition in the Planning tab while you talk.

If a step fails, don't soft-retry. Read the error, change the input, retry
**once**. The audience wastes nothing learning that you re-typed the same
command.

---

*Last update: after the Pronto Order Support build run. Lessons baked in:
`lightning__doubleType` 500, dialect `subagent` vs `topic`, quoted apex
targets, and the agent_user-free `AgentforceEmployeeAgent` default.*
