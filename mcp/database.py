import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise EnvironmentError("MONGO_URI is not set in your .env file")

_client: AsyncIOMotorClient | None = None

# Workload threshold — warn if user has >= this many active tasks
WORKLOAD_WARNING_THRESHOLD = int(os.getenv("WORKLOAD_THRESHOLD", "5"))


def _get_db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client["Jamot"]


def _parse_date(val):
    """Safely parse date — handles datetime objects and strings."""
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


def _safe_user(user: dict, profile: dict = None) -> dict:
    profile = profile or {}
    metadata = profile.get("metadata") or {}
    return {
        "userId": str(user["_id"]),
        "name": user.get("name", ""),
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "avatar": user.get("avatar", None),
        "profileType": profile.get("profileType", "employee"),
        "department": metadata.get("department", None),
        "impact_score": metadata.get("impact_score", 0.0),
        "competencies": metadata.get("competencies", []),
        "relational_value": metadata.get("relational_value", 0.0),
        "ecological_value": metadata.get("ecological_value", 0.0),
    }


def _safe_task(task: dict) -> dict:
    return {
        "taskId": str(task["_id"]),
        "title": task.get("title", ""),
        "parentId": str(task["parentId"]) if task.get("parentId") else None,
        "description": task.get("description", ""),
        "priority": task.get("priority", "medium"),
        "status": task.get("status", "pending"),
        "assignedTo": str(task["assignedTo"]) if task.get("assignedTo") else None,
        "economic_value": task.get("economic_value", 0),
        "relational_value": task.get("relational_value", 0),
        "ecological_value": task.get("ecological_value", 0),
        "impact_requirement": task.get("impact_requirement", 0.0),
        "context": task.get("context", {}),
        "isSubtask": task.get("isSubtask", False),
        "due_date": _parse_date(task.get("due_date")),
        "createdAt": _parse_date(task.get("createdAt")),
        "updatedAt": _parse_date(task.get("updatedAt")),
    }


# ─────────────────────────────────────────────
# MEMORY
# ─────────────────────────────────────────────

async def save_memory_db(key: str, content: str, tags: list = None) -> dict:
    """Save an agent memory entry to MongoDB."""
    db = _get_db()
    doc = {
        "key": key,
        "content": content,
        "tags": tags or [],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    # Upsert by key so memories stay fresh
    await db["agent_memory"].update_one(
        {"key": key},
        {"$set": doc},
        upsert=True,
    )
    return {"success": True, "key": key, "content": content}


async def get_memory_db(key: str = None, tag: str = None, limit: int = 10) -> list:
    """Retrieve agent memories. Filter by key or tag."""
    db = _get_db()
    query = {}
    if key:
        query["key"] = {"$regex": key, "$options": "i"}
    if tag:
        query["tags"] = tag

    cursor = db["agent_memory"].find(query).sort("updatedAt", -1).limit(limit)
    memories = await cursor.to_list(length=limit)
    return [
        {
            "key": m["key"],
            "content": m["content"],
            "tags": m.get("tags", []),
            "updatedAt": _parse_date(m.get("updatedAt")),
        }
        for m in memories
    ]


async def delete_memory_db(key: str) -> dict:
    """Delete a memory entry by key."""
    db = _get_db()
    result = await db["agent_memory"].delete_one({"key": key})
    return {"success": result.deleted_count > 0, "key": key}


# ─────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────

async def get_assignable_users_db(department: str = "all") -> list:
    db = _get_db()
    query = {}
    cursor = db["users"].find(query, {"name": 1, "username": 1, "email": 1, "avatar": 1})
    users = await cursor.to_list(length=200)
    return [_safe_user(u) for u in users]


async def get_user_by_id_db(user_id: str) -> dict | None:
    db = _get_db()
    try:
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        return _safe_user(user) if user else None
    except Exception:
        return None


# ─────────────────────────────────────────────
# WORKLOAD ANALYTICS
# ─────────────────────────────────────────────

async def get_team_analytics_db() -> dict:
    """Active (non-completed) task count per user."""
    db = _get_db()
    pipeline = [
        {"$match": {"status": {"$ne": "completed"}}},
        {"$group": {"_id": "$assignedTo", "activeTasks": {"$sum": 1}}},
    ]
    analytics = {}
    async for doc in db["tasks"].aggregate(pipeline):
        uid = str(doc["_id"]) if doc["_id"] else "unassigned"
        analytics[uid] = doc["activeTasks"]
    return analytics


async def check_workload_warning_db(user_id: str) -> dict:
    """
    Check if a specific user is at or above the workload threshold.
    Returns warning info if overloaded.
    """
    workload = await get_team_analytics_db()
    active = workload.get(user_id, 0)
    is_overloaded = active >= WORKLOAD_WARNING_THRESHOLD

    result = {
        "userId": user_id,
        "activeTasks": active,
        "threshold": WORKLOAD_WARNING_THRESHOLD,
        "isOverloaded": is_overloaded,
    }

    if is_overloaded:
        # Find alternative with lowest workload
        users = await get_assignable_users_db()
        alternatives = sorted(
            [
                {"userId": u["userId"], "name": u["name"], "activeTasks": workload.get(u["userId"], 0)}
                for u in users
                if u["userId"] != user_id
            ],
            key=lambda x: x["activeTasks"],
        )
        result["warning"] = f"User has {active} active tasks (threshold: {WORKLOAD_WARNING_THRESHOLD}). Consider reassigning."
        result["alternatives"] = alternatives[:3]

    return result


async def get_overdue_tasks_db() -> list:
    """Find all tasks that are past their due date and not completed."""
    db = _get_db()
    now = datetime.now(timezone.utc)
    query = {
        "status": {"$ne": "completed"},
        "due_date": {"$lt": now, "$exists": True, "$ne": None},
    }
    cursor = db["tasks"].find(query).sort("due_date", 1).limit(50)
    tasks = await cursor.to_list(length=50)
    return [_safe_task(t) for t in tasks]


async def get_best_assignee_db(
    required_competencies: list = None,
    min_impact: float = 0.0,
) -> dict | None:
    users = await get_assignable_users_db()
    workload = await get_team_analytics_db()

    candidates = []
    for u in users:
        uid = u["userId"]
        active = workload.get(uid, 0)
        impact = u.get("impact_score", 0.0)
        comps = u.get("competencies", [])

        if impact < min_impact:
            continue

        if required_competencies:
            match_count = sum(1 for c in required_competencies if c in comps)
            if match_count == 0:
                continue
        else:
            match_count = 0

        candidates.append({**u, "activeTasks": active, "matchScore": match_count})

    if not candidates:
        return None

    candidates.sort(key=lambda x: (-x["matchScore"], x["activeTasks"]))
    return candidates[0]


async def suggest_redistribution_db(max_tasks: int = None) -> dict:
    """
    Suggest task redistribution:
    - Find overloaded users (above threshold or max_tasks)
    - Find underloaded users
    - Return suggested task moves
    """
    threshold = max_tasks or WORKLOAD_WARNING_THRESHOLD
    workload = await get_team_analytics_db()
    users = await get_assignable_users_db()

    user_map = {u["userId"]: u["name"] for u in users}
    overloaded = []
    underloaded = []

    for uid, count in workload.items():
        if uid == "unassigned":
            continue
        name = user_map.get(uid, uid)
        if count >= threshold:
            overloaded.append({"userId": uid, "name": name, "activeTasks": count})
        elif count < threshold // 2:
            underloaded.append({"userId": uid, "name": name, "activeTasks": count})

    # Users with 0 tasks (not in workload map)
    for u in users:
        if u["userId"] not in workload:
            underloaded.append({"userId": u["userId"], "name": u["name"], "activeTasks": 0})

    underloaded.sort(key=lambda x: x["activeTasks"])

    return {
        "threshold": threshold,
        "overloaded": overloaded,
        "underloaded": underloaded[:5],
        "suggestion": (
            f"{len(overloaded)} member(s) overloaded. "
            f"Consider moving tasks to: {', '.join(u['name'] for u in underloaded[:3])}"
            if overloaded else "Team workload is balanced."
        ),
    }


# ─────────────────────────────────────────────
# TASKS
# ─────────────────────────────────────────────

async def create_task_db(
    title: str,
    assigned_to: str,
    priority: str,
    description: str,
    parent_id: str = None,
    context_data: dict = None,
    economic_value: int = 0,
    relational_value: int = 0,
    ecological_value: int = 0,
    impact_requirement: float = 0.0,
    due_date: str = None,
) -> dict:
    db = _get_db()

    due_date_parsed = None
    if due_date:
        try:
            due_date_parsed = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
        except Exception:
            due_date_parsed = None

    task_doc = {
        "title": title,
        "description": description,
        "priority": priority,
        "assignedTo": ObjectId(assigned_to) if assigned_to and assigned_to != "unassigned" else None,
        "status": "pending",
        "economic_value": economic_value,
        "relational_value": relational_value,
        "ecological_value": ecological_value,
        "impact_requirement": impact_requirement,
        "parentId": ObjectId(parent_id) if parent_id else None,
        "context": context_data or {},
        "isSubtask": bool(parent_id),
        "due_date": due_date_parsed,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db["tasks"].insert_one(task_doc)
    created = await db["tasks"].find_one({"_id": result.inserted_id})
    return {"success": True, **_safe_task(created)}


async def get_tasks_db(
    assigned_to: str = "all",
    status: str = "all",
    parent_id: str = None,
) -> list:
    db = _get_db()
    query = {}
    if assigned_to != "all":
        try:
            query["assignedTo"] = ObjectId(assigned_to)
        except Exception:
            return []
    if status != "all":
        query["status"] = status
    if parent_id:
        query["parentId"] = ObjectId(parent_id)

    cursor = db["tasks"].find(query).sort("createdAt", -1).limit(100)
    tasks = await cursor.to_list(length=100)
    return [_safe_task(t) for t in tasks]


async def edit_task_db(
    task_id: str,
    title: str = None,
    description: str = None,
    priority: str = None,
    status: str = None,
    assigned_to: str = None,
    context_data: dict = None,
    due_date: str = None,
) -> dict:
    db = _get_db()
    try:
        task_oid = ObjectId(task_id)
    except Exception:
        return {"success": False, "error": f"Invalid taskId: {task_id}"}

    task = await db["tasks"].find_one({"_id": task_oid})
    if not task:
        return {"success": False, "error": f"Task '{task_id}' not found"}

    updates = {"updatedAt": datetime.now(timezone.utc)}
    if title is not None:
        updates["title"] = title
    if description is not None:
        updates["description"] = description
    if priority is not None:
        if priority not in ("low", "medium", "high"):
            return {"success": False, "error": "priority must be low, medium, or high"}
        updates["priority"] = priority
    if status is not None:
        if status not in ("pending", "in-progress", "completed"):
            return {"success": False, "error": "status must be pending, in-progress, or completed"}
        updates["status"] = status
    if assigned_to is not None:
        try:
            updates["assignedTo"] = ObjectId(assigned_to)
        except Exception:
            return {"success": False, "error": f"Invalid userId: {assigned_to}"}
    if context_data is not None:
        existing = task.get("context", {})
        existing.update(context_data)
        updates["context"] = existing
    if due_date is not None:
        try:
            updates["due_date"] = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
        except Exception:
            pass

    await db["tasks"].update_one({"_id": task_oid}, {"$set": updates})
    updated = await db["tasks"].find_one({"_id": task_oid})
    return {"success": True, **_safe_task(updated)}


async def delete_task_db(task_id: str) -> dict:
    db = _get_db()
    try:
        task_oid = ObjectId(task_id)
    except Exception:
        return {"success": False, "error": f"Invalid taskId: {task_id}"}

    task = await db["tasks"].find_one({"_id": task_oid})
    if not task:
        return {"success": False, "error": f"Task '{task_id}' not found"}

    if not task.get("isSubtask"):
        await db["tasks"].delete_many({"parentId": task_oid})

    await db["tasks"].delete_one({"_id": task_oid})
    return {
        "success": True,
        "taskId": task_id,
        "message": f"Task '{task.get('title', '')}' deleted successfully",
    }