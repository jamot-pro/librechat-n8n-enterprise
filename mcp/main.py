from fastmcp import FastMCP
from database import (
    get_assignable_users_db,
    get_best_assignee_db,
    get_team_analytics_db,
    check_workload_warning_db,
    get_overdue_tasks_db,
    suggest_redistribution_db,
    create_task_db,
    get_tasks_db,
    edit_task_db,
    delete_task_db,
    save_memory_db,
    get_memory_db,
    delete_memory_db,
)

mcp = FastMCP("A2H Task Assignment")


# ─────────────────────────────────────────────
# MEMORY
# ─────────────────────────────────────────────

@mcp.tool()
async def save_memory(key: str, content: str, tags: list = None) -> dict:
    """
    Save important context, decisions, or patterns to long-term memory.
    Use this to remember things across conversations, such as:
    - User preferences ("Lachlan prefers high priority tasks")
    - Past decisions ("Q2 research was assigned to Budi")
    - Team patterns ("Design tasks always go to Siti")
    key: short identifier (e.g. "lachlan_preference", "q2_decisions")
    tags: optional labels (e.g. ["design", "preference"])
    """
    return await save_memory_db(key, content, tags)


@mcp.tool()
async def get_memory(key: str = "", tag: str = "") -> list:
    """
    Retrieve past memories. Filter by key (partial match) or tag.
    Call this at the start of a conversation to recall relevant context.
    Example: get_memory(tag="preference") returns all user preferences.
    """
    return await get_memory_db(key or None, tag or None)


@mcp.tool()
async def delete_memory(key: str) -> dict:
    """Delete a memory entry by its exact key."""
    return await delete_memory_db(key)


# ─────────────────────────────────────────────
# USERS & PROFILES
# ─────────────────────────────────────────────

@mcp.tool()
async def get_assignable_users(department: str = "all") -> list:
    """
    Fetch all assignable users from the internal A2H MongoDB database.
    No external system needed. No scope or project key required.
    Just call this directly to get the list of people who can be assigned tasks.
    """
    return await get_assignable_users_db(department)


@mcp.tool()
async def get_human_profiles(min_impact: float = 0.0) -> list:
    """Get human profiles filtered by minimum impact score."""
    users = await get_assignable_users_db()
    if min_impact > 0.0:
        users = [u for u in users if u.get("impact_score", 0.0) >= min_impact]
    return users


@mcp.tool()
async def recommend_best_assignee(
    required_competencies: list = None,
    min_impact: float = 0.0,
) -> dict:
    """
    Recommend the best available person for a task based on:
    - Current workload (fewest active tasks)
    - Competency match (optional)
    - Minimum impact score (optional)
    Use this BEFORE creating a task.
    """
    result = await get_best_assignee_db(required_competencies, min_impact)
    if not result:
        return {"found": False, "message": "No suitable assignee found"}
    return {"found": True, **result}


# ─────────────────────────────────────────────
# WORKLOAD & ANALYTICS
# ─────────────────────────────────────────────

@mcp.tool()
async def get_team_workload_report() -> dict:
    """
    Get active task count per user.
    Use this to check team capacity before assigning new work.
    Returns: { userId: activeTasks }
    """
    return await get_team_analytics_db()


@mcp.tool()
async def check_workload_before_assign(user_id: str) -> dict:
    """
    ALWAYS call this before assigning a task to a specific user.
    Returns a warning if the user is overloaded (>= threshold active tasks),
    along with alternative assignees with lower workload.
    If isOverloaded is true, consider reassigning to one of the alternatives.
    """
    return await check_workload_warning_db(user_id)


@mcp.tool()
async def get_overdue_tasks() -> list:
    """
    Find all tasks that are past their due date and not yet completed.
    Use this proactively to flag overdue work and suggest reassignment.
    """
    return await get_overdue_tasks_db()


@mcp.tool()
async def suggest_redistribution(max_tasks: int = None) -> dict:
    """
    Analyze team workload and suggest task redistribution.
    Identifies overloaded members and underloaded members who can take more work.
    Call this when workload seems unbalanced or when someone reports being overwhelmed.
    """
    return await suggest_redistribution_db(max_tasks)


# ─────────────────────────────────────────────
# TASKS
# ─────────────────────────────────────────────

@mcp.tool()
async def get_tasks(
    assigned_to: str = "all",
    status: str = "all",
) -> list:
    """
    Get tasks from the internal database.
    Filter by assignee userId and/or status: all | pending | in-progress | completed
    """
    return await get_tasks_db(assigned_to, status)


@mcp.tool()
async def create_a2h_task(
    title: str,
    assigned_to: str,
    description: str,
    chat_summary: str = "",
    document_references: list = None,
    goals: list = None,
    economic_value: int = 0,
    relational_value: int = 0,
    ecological_value: int = 0,
    priority: str = "medium",
    impact_requirement: float = 0.0,
    due_date: str = None,
) -> dict:
    """
    Create a task with full contextual handover.
    IMPORTANT: Before calling this, call check_workload_before_assign(assigned_to)
    and warn the user if the assignee is overloaded.

    Contextual handover:
    - chat_summary: what led to this task
    - document_references: relevant docs/URLs
    - goals: expected outcomes
    - due_date: ISO format e.g. "2026-05-05T00:00:00Z"
    """
    # Auto workload check — block if assignee is overloaded
    workload_check = await check_workload_warning_db(assigned_to)
    if workload_check.get("isOverloaded"):
        return {
            "success": False,
            "blocked": True,
            "warning": workload_check.get("warning"),
            "activeTasks": workload_check.get("activeTasks"),
            "threshold": workload_check.get("threshold"),
            "alternatives": workload_check.get("alternatives", []),
            "message": "Task creation blocked. Assignee is overloaded. Choose an alternative or increase threshold.",
        }

    context_data = {
        "chat_summary": chat_summary,
        "document_references": document_references or [],
        "goals": goals or [],
        "created_from": "agent",
    }
    return await create_task_db(
        title=title,
        assigned_to=assigned_to,
        priority=priority,
        description=description,
        context_data=context_data,
        economic_value=economic_value,
        relational_value=relational_value,
        ecological_value=ecological_value,
        impact_requirement=impact_requirement,
        due_date=due_date,
    )


@mcp.tool()
async def edit_task(
    task_id: str,
    title: str = None,
    description: str = None,
    priority: str = None,
    status: str = None,
    assigned_to: str = None,
    context_update: dict = None,
    due_date: str = None,
) -> dict:
    """
    Edit an existing task. Only provided fields are updated.
    context_update is merged with existing context.
    due_date format: "2026-05-05T00:00:00Z"
    """
    return await edit_task_db(
        task_id, title, description, priority, status, assigned_to, context_update, due_date
    )


@mcp.tool()
async def delete_task(task_id: str) -> dict:
    """
    Delete a task by its ID.
    If it is a parent task, all its subtasks are also deleted.
    """
    return await delete_task_db(task_id)


# ─────────────────────────────────────────────
# TASK DECOMPOSITION
# ─────────────────────────────────────────────

@mcp.tool()
async def decompose_task(
    main_task_title: str,
    subtasks: list,
    assigned_to: str,
    context_summary: str = "",
    document_references: list = None,
    goals: list = None,
    due_date: str = None,
) -> dict:
    """
    Break a complex instruction into a parent task + subtasks.
    Each subtask: { title, description (optional), priority (optional: low|medium|high) }
    Context is passed to ALL subtasks so every assignee has full background.
    Before calling, use check_workload_before_assign to verify the assignee.
    """
    context_data = {
        "chat_summary": context_summary,
        "document_references": document_references or [],
        "goals": goals or [],
        "created_from": "agent_decomposition",
    }

    parent = await create_task_db(
        title=f"[Parent] {main_task_title}",
        assigned_to=assigned_to,
        priority="medium",
        description=f"Coordination task: {main_task_title}",
        context_data=context_data,
        due_date=due_date,
    )

    parent_id = parent["taskId"]
    created_subtasks = []
    for st in subtasks:
        res = await create_task_db(
            title=st["title"],
            assigned_to=assigned_to,
            priority=st.get("priority", "medium"),
            description=st.get("description", ""),
            parent_id=parent_id,
            context_data=context_data,
            due_date=st.get("due_date", due_date),
        )
        created_subtasks.append(res)

    return {
        "mainTask": parent,
        "subtasksCreated": len(created_subtasks),
        "details": created_subtasks,
    }


@mcp.tool()
async def smart_assign_and_decompose(
    main_task_title: str,
    subtasks: list,
    context_summary: str = "",
    document_references: list = None,
    goals: list = None,
    required_competencies: list = None,
    due_date: str = None,
) -> dict:
    """
    Full coordination brain — one call does everything:
    1. Check team workload
    2. Find best assignee (lowest workload + competency match)
    3. Warn if all members are overloaded
    4. Decompose into parent + subtasks
    5. Attach full context to every task

    Use for complex instructions that need automatic routing.
    Each subtask: { title, description (optional), priority (optional) }
    """
    best = await get_best_assignee_db(required_competencies or [], 0.0)
    if not best:
        return {"success": False, "message": "No available assignee found."}

    # Auto workload warning
    workload_check = await check_workload_warning_db(best["userId"])
    warning = workload_check.get("warning") if workload_check.get("isOverloaded") else None

    context_data = {
        "chat_summary": context_summary,
        "document_references": document_references or [],
        "goals": goals or [],
        "created_from": "agent_smart_assign",
    }

    parent = await create_task_db(
        title=f"[Parent] {main_task_title}",
        assigned_to=best["userId"],
        priority="medium",
        description=f"Coordination task: {main_task_title}",
        context_data=context_data,
        due_date=due_date,
    )

    parent_id = parent["taskId"]
    created_subtasks = []
    for st in subtasks:
        res = await create_task_db(
            title=st["title"],
            assigned_to=best["userId"],
            priority=st.get("priority", "medium"),
            description=st.get("description", ""),
            parent_id=parent_id,
            context_data=context_data,
            due_date=st.get("due_date", due_date),
        )
        created_subtasks.append(res)

    return {
        "success": True,
        "workloadWarning": warning,
        "assignedTo": {
            "userId": best["userId"],
            "name": best["name"],
            "activeTasks": best["activeTasks"],
        },
        "mainTask": parent,
        "subtasksCreated": len(created_subtasks),
        "details": created_subtasks,
    }


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=3001)