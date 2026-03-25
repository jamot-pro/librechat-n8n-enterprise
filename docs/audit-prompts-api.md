# Audit Prompts API — Integration Guide

## Overview

The Audit Prompts API allows external services to fetch prompt templates managed by the Jamot platform. Prompts are versioned — each edit creates a new version while preserving history.

**Base URL:** `https://app.jamot.pro` (or your deployment URL)

## Authentication

All requests require a Bearer token using the shared API secret.

```
Authorization: Bearer <ADMIN_API_SECRET>
```

---

## Endpoints

### List All Prompts

Returns all active, latest-version prompts.

```
GET /api/audit-prompts/public
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string | — | Filter by category (e.g. `inspection`, `compliance`) |
| `active` | string | `"true"` | Set to `"false"` to include deactivated prompts |

**Response:**

```json
{
  "prompts": [
    {
      "_id": "69bf10bcb81b52872c9db73f",
      "key": "prompt_safety_inspection",
      "version": 3,
      "name": "Safety Inspection",
      "content": "You are an auditor conducting a safety inspection...",
      "description": "Main prompt for safety audit sessions",
      "category": "inspection",
      "isLatest": true,
      "isActive": true,
      "createdAt": "2026-03-21T21:42:20.366Z",
      "updatedAt": "2026-03-21T21:42:20.366Z"
    }
  ],
  "total": 1
}
```

---

### Get a Single Prompt

Fetch a specific prompt by its key. Returns the latest version by default.

```
GET /api/audit-prompts/public?key=prompt_safety_inspection
```

To fetch a specific version:

```
GET /api/audit-prompts/public?key=prompt_safety_inspection&version=2
```

| Param | Type | Default | Description |
|---|---|---|---|
| `key` | string | **required** | The prompt key (e.g. `prompt_safety_inspection`) |
| `version` | string | `"latest"` | Integer version number, or omit for latest |

**Response:** A single prompt object (same shape as the list items above).

---

### List Versions of a Prompt

Returns all versions of a prompt, sorted newest first.

```
GET /api/audit-prompts/public/prompt_safety_inspection/versions
```

**Response:**

```json
{
  "versions": [
    {
      "_id": "69bf12ab...",
      "key": "prompt_safety_inspection",
      "version": 3,
      "name": "Safety Inspection",
      "isLatest": true,
      "isActive": true,
      "createdAt": "2026-03-21T22:10:00.000Z"
    },
    {
      "_id": "69bf10bc...",
      "key": "prompt_safety_inspection",
      "version": 2,
      "name": "Safety Inspection",
      "isLatest": false,
      "isActive": true,
      "createdAt": "2026-03-21T21:42:20.366Z"
    },
    {
      "_id": "69bf0f01...",
      "key": "prompt_safety_inspection",
      "version": 1,
      "name": "Safety Inspection",
      "isLatest": false,
      "isActive": true,
      "createdAt": "2026-03-20T10:00:00.000Z"
    }
  ]
}
```

---

## Prompt Object

| Field | Type | Description |
|---|---|---|
| `key` | string | Unique identifier. Format: `prompt_<lowercase_underscored>` |
| `version` | number | Integer version, starts at 1, increments on each edit |
| `name` | string | Human-readable name |
| `content` | string | The prompt text (Markdown) |
| `description` | string | Short summary of what this prompt does |
| `category` | string | Grouping category (e.g. `general`, `inspection`, `compliance`) |
| `isLatest` | boolean | `true` if this is the current version |
| `isActive` | boolean | `false` if the prompt has been deactivated by an admin |
| `createdAt` | string | ISO 8601 timestamp |

---

## Error Responses

| Status | Body | Meaning |
|---|---|---|
| `401` | `{"error": "Invalid or missing API secret"}` | Missing or wrong `Authorization` header |
| `404` | `{"error": "Prompt not found"}` | No prompt with that key (or version) exists |
| `503` | `{"error": "API secret not configured"}` | Server has no `ADMIN_API_SECRET` set |

---

## Examples

**curl — Fetch all prompts:**

```bash
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  https://app.jamot.pro/api/audit-prompts/public
```

**curl — Fetch one prompt by key:**

```bash
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  "https://app.jamot.pro/api/audit-prompts/public?key=prompt_safety_inspection"
```

**curl — Fetch specific version:**

```bash
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  "https://app.jamot.pro/api/audit-prompts/public?key=prompt_safety_inspection&version=2"
```

**curl — Filter by category:**

```bash
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  "https://app.jamot.pro/api/audit-prompts/public?category=inspection"
```

**Python:**

```python
import requests

API_URL = "https://app.jamot.pro/api/audit-prompts/public"
SECRET = "YOUR_API_SECRET"

# Get all prompts
response = requests.get(API_URL, headers={"Authorization": f"Bearer {SECRET}"})
prompts = response.json()["prompts"]

# Get one by key
response = requests.get(API_URL, params={"key": "prompt_safety_inspection"},
                        headers={"Authorization": f"Bearer {SECRET}"})
prompt = response.json()
print(prompt["content"])
```

**Node.js:**

```javascript
const res = await fetch('https://app.jamot.pro/api/audit-prompts/public?key=prompt_safety_inspection', {
  headers: { 'Authorization': 'Bearer YOUR_API_SECRET' },
});
const prompt = await res.json();
console.log(prompt.content);
```
