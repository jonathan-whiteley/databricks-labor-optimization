"""Genie conversational chat — wraps the Databricks Genie Conversation API.

The frontend Ask Genie panel POSTs here with `{question, conversation_id?}`.
The first question starts a new conversation (no conversation_id); follow-ups
pass the conversation_id returned in the prior response so Genie keeps
context. Table results for any query attachment are fetched and serialized
into a JSON-friendly shape.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from databricks.sdk import WorkspaceClient
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/genie", tags=["genie"])

_w = WorkspaceClient()


class AskBody(BaseModel):
    question: str
    conversation_id: str | None = None


class TableColumn(BaseModel):
    name: str
    type: str


class TableData(BaseModel):
    columns: list[TableColumn]
    rows: list[list[Any]]
    row_count: int
    truncated: bool


class GenieResponse(BaseModel):
    conversation_id: str
    message_id: str
    text: str
    sql: str | None = None
    table: TableData | None = None


@router.post("/ask")
async def ask(body: AskBody) -> GenieResponse:
    s = settings()
    space_id = s.genie_space_id
    if not space_id:
        raise HTTPException(503, "GENIE_SPACE_ID not configured")

    q = body.question.strip()
    if not q:
        raise HTTPException(400, "question is required")

    try:
        if body.conversation_id:
            msg = await asyncio.to_thread(
                _w.genie.create_message_and_wait,
                space_id,
                body.conversation_id,
                q,
            )
        else:
            msg = await asyncio.to_thread(
                _w.genie.start_conversation_and_wait,
                space_id,
                q,
            )
    except Exception as e:
        log.exception("genie call failed")
        raise HTTPException(502, f"Genie call failed: {e}") from e

    # Genie sometimes returns a non-terminal status if polling timed out.
    status = getattr(msg, "status", None)
    status_str = getattr(status, "value", None) or str(status or "")
    if status and "COMPLETED" not in status_str.upper():
        log.warning("genie message returned non-COMPLETED status: %s", status)

    return await _serialize(msg, space_id)


async def _serialize(msg, space_id: str) -> GenieResponse:
    text_parts: list[str] = []
    sql: str | None = None
    table: TableData | None = None

    for att in getattr(msg, "attachments", None) or []:
        text_att = getattr(att, "text", None)
        if text_att and getattr(text_att, "content", None):
            text_parts.append(text_att.content)

        query_att = getattr(att, "query", None)
        if query_att:
            sql = getattr(query_att, "query", None)
            attachment_id = getattr(att, "attachment_id", None)
            if not attachment_id:
                continue
            try:
                # The by-attachment endpoint returns the actual rows; the older
                # get_message_query_result returns an empty data_array.
                result = await asyncio.to_thread(
                    _w.genie.get_message_query_result_by_attachment,
                    space_id,
                    msg.conversation_id,
                    msg.id,
                    attachment_id,
                )
                table = _serialize_table(result)
            except Exception as e:
                log.warning("query result fetch failed: %s", e)

    return GenieResponse(
        conversation_id=msg.conversation_id,
        message_id=msg.id,
        text="\n\n".join(text_parts) or "(Genie returned no text — see the data below.)",
        sql=sql,
        table=table,
    )


def _serialize_table(result) -> TableData | None:
    """Convert the Statement Execution API response wrapped by Genie into rows."""
    sr = getattr(result, "statement_response", None)
    if not sr:
        return None
    manifest = getattr(sr, "manifest", None)
    data = getattr(sr, "result", None)
    if not manifest or not data:
        return None
    schema = getattr(manifest, "schema", None)
    if not schema:
        return None
    cols = [
        TableColumn(
            name=getattr(c, "name", ""),
            type=getattr(c, "type_name", None) or getattr(c, "type_text", "") or "",
        )
        for c in (getattr(schema, "columns", None) or [])
    ]
    rows = getattr(data, "data_array", None) or []
    MAX = 50
    return TableData(
        columns=cols,
        rows=rows[:MAX],
        row_count=len(rows),
        truncated=len(rows) > MAX,
    )
