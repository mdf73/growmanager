#!/usr/bin/env python3
"""
Serveur MCP GrowManager.

Génère automatiquement un outil MCP pour chaque endpoint exposé par l'API
FastAPI de GrowManager, à partir de son schéma OpenAPI. Deux modes :

- Lecture seule (par défaut) : seuls les endpoints GET sont exposés.
- Lecture + écriture (GROWMANAGER_MCP_READONLY=false) : POST/PUT/PATCH/DELETE
  sont aussi exposés, avec des annotations MCP (readOnlyHint/destructiveHint/
  idempotentHint) fidèles à la méthode HTTP, pour que les clients MCP
  compatibles avertissent avant d'exécuter une action destructive.

Deux transports :
- stdio (par défaut) : pour Claude Desktop / Claude Code en local, lancé
  comme sous-processus. Pas d'authentification nécessaire (le processus
  n'est accessible qu'au même utilisateur système).
- http (GROWMANAGER_MCP_TRANSPORT=http) : serveur HTTP "Streamable HTTP"
  MCP, pour un déploiement en conteneur sur le réseau local. Exige un jeton
  d'authentification (GROWMANAGER_MCP_TOKEN) — le serveur refuse de démarrer
  en HTTP sans jeton défini.

Variables d'environnement :
    GROWMANAGER_API_URL       URL de base de l'API GrowManager (défaut: http://localhost:8000)
    GROWMANAGER_MCP_EXCLUDE   Motifs de chemin à exclure, séparés par des virgules
                              (défaut: /health,/api/import-export,/api/tapo/discover)
    GROWMANAGER_MCP_READONLY  "true" (défaut) ou "false" — autoriser l'écriture
    GROWMANAGER_MCP_TRANSPORT "stdio" (défaut) ou "http"
    GROWMANAGER_MCP_TOKEN     Jeton porteur requis par les clients en mode http
    GROWMANAGER_MCP_HTTP_HOST Adresse d'écoute en mode http (défaut: 0.0.0.0)
    GROWMANAGER_MCP_HTTP_PORT Port d'écoute en mode http (défaut: 8100)

Lancement :
    python server.py
"""
from __future__ import annotations

import asyncio
import copy
import json
import logging
import os
import re
import sys
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel import NotificationOptions
from mcp.server.stdio import stdio_server
import mcp.types as types

logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("growmanager_mcp")

API_BASE_URL = os.environ.get("GROWMANAGER_API_URL", "http://localhost:8000").rstrip("/")
# Motifs de chemin (sous-chaînes) à ne jamais exposer, quelle que soit la méthode.
EXCLUDE_PATTERNS = [
    p.strip()
    for p in os.environ.get(
        "GROWMANAGER_MCP_EXCLUDE", "/health,/api/import-export,/api/tapo/discover"
    ).split(",")
    if p.strip()
]
READONLY = os.environ.get("GROWMANAGER_MCP_READONLY", "true").strip().lower() not in ("false", "0", "no")
TRANSPORT = os.environ.get("GROWMANAGER_MCP_TRANSPORT", "stdio").strip().lower()
MCP_TOKEN = os.environ.get("GROWMANAGER_MCP_TOKEN")
HTTP_HOST = os.environ.get("GROWMANAGER_MCP_HTTP_HOST", "0.0.0.0")
HTTP_PORT = int(os.environ.get("GROWMANAGER_MCP_HTTP_PORT", "8100"))
# Nombre max de caractères renvoyés par un appel d'outil avant troncature.
MAX_RESPONSE_CHARS = 20_000
HTTP_TIMEOUT = 30.0
TOOL_NAME_PREFIX = "growmanager_"

METHODS_ALLOWED = ("get",) if READONLY else ("get", "post", "put", "patch", "delete")

_VERB_BY_METHOD = {
    "get": None,  # décidé dynamiquement : "get" (détail) ou "list" (collection)
    "post": "create",
    "put": "update",
    "patch": "patch",
    "delete": "delete",
}

_ANNOTATIONS_BY_METHOD = {
    "get": dict(readOnlyHint=True, destructiveHint=False, idempotentHint=True),
    "post": dict(readOnlyHint=False, destructiveHint=False, idempotentHint=False),
    "put": dict(readOnlyHint=False, destructiveHint=False, idempotentHint=True),
    "patch": dict(readOnlyHint=False, destructiveHint=False, idempotentHint=False),
    "delete": dict(readOnlyHint=False, destructiveHint=True, idempotentHint=True),
}

_METHOD_LABEL_FR = {
    "get": "lecture seule",
    "post": "écriture — création",
    "put": "écriture — remplacement",
    "patch": "écriture — modification partielle",
    "delete": "écriture destructive — suppression",
}


class EndpointSpec:
    """Décrit un endpoint de l'API GrowManager, prêt à être appelé."""

    __slots__ = (
        "tool_name",
        "method",
        "path",
        "description",
        "path_params",
        "query_params",
        "has_body",
        "body_required",
        "body_schema",
        "body_defs",
    )

    def __init__(
        self,
        tool_name: str,
        method: str,
        path: str,
        description: str,
        path_params: list[dict[str, Any]],
        query_params: list[dict[str, Any]],
        has_body: bool,
        body_required: bool,
        body_schema: dict[str, Any] | None = None,
        body_defs: dict[str, Any] | None = None,
    ):
        self.tool_name = tool_name
        self.method = method
        self.path = path
        self.description = description
        self.path_params = path_params
        self.query_params = query_params
        self.has_body = has_body
        self.body_required = body_required
        self.body_schema = body_schema
        self.body_defs = body_defs or {}


def _is_excluded(path: str) -> bool:
    return any(pattern in path for pattern in EXCLUDE_PATTERNS)


def _sanitize_tool_name(raw: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9_]+", "_", raw).strip("_").lower()
    return f"{TOOL_NAME_PREFIX}{name}"[:64]


def _tool_name_from_route(method: str, path: str) -> str:
    """Construit un nom d'outil lisible à partir de la méthode et du chemin, ex :
    GET  /api/cultures/{culture_id} -> get_api_cultures_by_culture_id
    GET  /api/cultures/              -> list_api_cultures
    POST /api/cultures/              -> create_api_cultures
    PUT  /api/cultures/{culture_id} -> update_api_cultures_by_culture_id
    """
    segments = [seg for seg in path.strip("/").split("/") if seg]
    tokens = [f"by_{seg[1:-1]}" if seg.startswith("{") and seg.endswith("}") else seg for seg in segments]
    verb = _VERB_BY_METHOD[method]
    if verb is None:  # GET
        verb = "get" if segments and segments[-1].startswith("{") else "list"
    return _sanitize_tool_name(f"{verb}_" + "_".join(tokens))


def _json_schema_for_param(param: dict[str, Any]) -> dict[str, Any]:
    schema = dict(param.get("schema") or {"type": "string"})
    # OpenAPI 3.1 encode Optional[...] via anyOf; on simplifie pour un JSON Schema
    # basique compréhensible par les clients MCP.
    if "anyOf" in schema and "type" not in schema:
        for sub in schema["anyOf"]:
            if sub.get("type") and sub.get("type") != "null":
                schema = dict(sub)
                break
    schema.pop("title", None)
    if param.get("description") and "description" not in schema:
        schema["description"] = param["description"]
    return schema


def _collect_component_refs(node: Any, found: set[str]) -> None:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
            found.add(ref.rsplit("/", 1)[-1])
        for v in node.values():
            _collect_component_refs(v, found)
    elif isinstance(node, list):
        for item in node:
            _collect_component_refs(item, found)


def _rewrite_component_refs(node: Any) -> Any:
    """Réécrit les $ref '#/components/schemas/X' en '#/$defs/X', pour produire
    un JSON Schema autonome (sans dépendre du document OpenAPI complet)."""
    if isinstance(node, dict):
        new: dict[str, Any] = {}
        for k, v in node.items():
            if k == "$ref" and isinstance(v, str) and v.startswith("#/components/schemas/"):
                new[k] = "#/$defs/" + v.rsplit("/", 1)[-1]
            else:
                new[k] = _rewrite_component_refs(v)
        return new
    if isinstance(node, list):
        return [_rewrite_component_refs(item) for item in node]
    return node


def _resolve_body_schema(
    body_schema_raw: dict[str, Any], components_schemas: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Calcule la fermeture transitive des schémas référencés par le corps de
    requête, et renvoie (schéma_du_corps_réécrit, defs_à_embarquer)."""
    body_schema_raw = copy.deepcopy(body_schema_raw)
    closure: set[str] = set()
    frontier: set[str] = set()
    _collect_component_refs(body_schema_raw, frontier)
    closure |= frontier
    while frontier:
        next_frontier: set[str] = set()
        for name in frontier:
            schema = components_schemas.get(name)
            if schema is None:
                continue
            found: set[str] = set()
            _collect_component_refs(schema, found)
            new_names = found - closure
            closure |= new_names
            next_frontier |= new_names
        frontier = next_frontier

    defs = {
        name: _rewrite_component_refs(copy.deepcopy(components_schemas[name]))
        for name in closure
        if name in components_schemas
    }
    resolved_body = _rewrite_component_refs(body_schema_raw)
    return resolved_body, defs


def build_endpoints(openapi_spec: dict[str, Any]) -> list[EndpointSpec]:
    """Construit la liste des endpoints exposables à partir du schéma OpenAPI."""
    endpoints: list[EndpointSpec] = []
    seen_names: set[str] = set()
    components_schemas = ((openapi_spec.get("components") or {}).get("schemas")) or {}

    for path, path_item in (openapi_spec.get("paths") or {}).items():
        if _is_excluded(path):
            continue
        for method in METHODS_ALLOWED:
            operation = path_item.get(method)
            if not operation:
                continue

            tags = operation.get("tags") or []
            summary = operation.get("summary") or path
            description = operation.get("description") or ""
            tag_prefix = f"[{tags[0]}] " if tags else ""
            full_description = f"{tag_prefix}{summary}".strip()
            if description and description != summary:
                full_description += f"\n\n{description}"
            full_description += f"\n\n({method.upper()} {path} — {_METHOD_LABEL_FR[method]})"

            path_params = []
            query_params = []
            for param in operation.get("parameters", []):
                entry = {
                    "name": param["name"],
                    "required": bool(param.get("required")),
                    "schema": _json_schema_for_param(param),
                }
                if param.get("in") == "path":
                    path_params.append(entry)
                elif param.get("in") == "query":
                    query_params.append(entry)

            has_body = False
            body_required = False
            body_schema = None
            body_defs: dict[str, Any] = {}
            request_body = operation.get("requestBody")
            if request_body:
                json_content = (request_body.get("content") or {}).get("application/json")
                if json_content and "schema" in json_content:
                    has_body = True
                    body_required = bool(request_body.get("required"))
                    body_schema, body_defs = _resolve_body_schema(json_content["schema"], components_schemas)

            tool_name = _tool_name_from_route(method, path)
            base_name = tool_name
            suffix = 2
            while tool_name in seen_names:
                tool_name = f"{base_name}_{suffix}"[:64]
                suffix += 1
            seen_names.add(tool_name)

            endpoint = EndpointSpec(
                tool_name=tool_name,
                method=method,
                path=path,
                description=full_description,
                path_params=path_params,
                query_params=query_params,
                has_body=has_body,
                body_required=body_required,
                body_schema=body_schema,
                body_defs=body_defs,
            )
            endpoints.append(endpoint)

    return endpoints


def endpoint_to_mcp_tool(endpoint: EndpointSpec) -> types.Tool:
    properties: dict[str, Any] = {}
    required: list[str] = []
    all_defs: dict[str, Any] = {}

    for p in endpoint.path_params + endpoint.query_params:
        properties[p["name"]] = p["schema"]
        if p["required"]:
            required.append(p["name"])

    if endpoint.has_body:
        properties["body"] = endpoint.body_schema or {"type": "object"}
        all_defs.update(endpoint.body_defs or {})
        if endpoint.body_required:
            required.append("body")

    input_schema: dict[str, Any] = {
        "type": "object",
        "properties": properties,
    }
    if required:
        input_schema["required"] = required
    if all_defs:
        input_schema["$defs"] = all_defs

    ann = _ANNOTATIONS_BY_METHOD[endpoint.method]
    return types.Tool(
        name=endpoint.tool_name,
        description=endpoint.description,
        inputSchema=input_schema,
        annotations=types.ToolAnnotations(
            readOnlyHint=ann["readOnlyHint"],
            destructiveHint=ann["destructiveHint"],
            idempotentHint=ann["idempotentHint"],
            openWorldHint=False,
        ),
    )


def _resolve_call(endpoint: EndpointSpec, arguments: dict[str, Any]) -> tuple[str, dict[str, Any], Any]:
    """Remplace les paramètres de chemin, sépare la query et le corps de requête."""
    path = endpoint.path
    remaining = dict(arguments)

    body = remaining.pop("body", None) if endpoint.has_body else None
    if endpoint.has_body and endpoint.body_required and body is None:
        raise ValueError("Le paramètre 'body' est requis pour cet outil.")

    for p in endpoint.path_params:
        name = p["name"]
        if name not in remaining:
            raise ValueError(f"Paramètre de chemin manquant : '{name}'")
        path = path.replace("{" + name + "}", str(remaining.pop(name)))

    query_names = {p["name"] for p in endpoint.query_params}
    query_params = {k: v for k, v in remaining.items() if k in query_names and v is not None}
    return path, query_params, body


def _format_error(exc: Exception, endpoint: EndpointSpec) -> str:
    verb = endpoint.method.upper()
    if isinstance(exc, httpx.ConnectError):
        return (
            f"Erreur : impossible de joindre l'API GrowManager sur {API_BASE_URL}. "
            "Vérifie que le backend tourne et que GROWMANAGER_API_URL pointe vers la bonne adresse."
        )
    if isinstance(exc, httpx.TimeoutException):
        return f"Erreur : délai dépassé en appelant {verb} {endpoint.path}. Réessaie, ou vérifie la charge du backend."
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 404:
            return f"Erreur 404 : ressource introuvable pour {verb} {endpoint.path}. Vérifie les identifiants fournis."
        if status == 422:
            try:
                detail = exc.response.json()
            except Exception:
                detail = exc.response.text
            return f"Erreur 422 : paramètres invalides pour {verb} {endpoint.path}. Détail : {detail}"
        return f"Erreur {status} en appelant {verb} {endpoint.path} : {exc.response.text[:500]}"
    return f"Erreur inattendue ({type(exc).__name__}) en appelant {verb} {endpoint.path} : {exc}"


async def call_endpoint(client: httpx.AsyncClient, endpoint: EndpointSpec, arguments: dict[str, Any]) -> str:
    try:
        path, query_params, body = _resolve_call(endpoint, arguments)
    except ValueError as exc:
        return f"Erreur : {exc}"

    try:
        response = await client.request(
            endpoint.method.upper(),
            f"{API_BASE_URL}{path}",
            params=query_params,
            json=body if endpoint.has_body else None,
            timeout=HTTP_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json() if response.content else {"status": "ok", "http_status": response.status_code}
    except Exception as exc:  # httpx errors + json decode errors
        return _format_error(exc, endpoint)

    text = json.dumps(data, indent=2, ensure_ascii=False)
    if len(text) > MAX_RESPONSE_CHARS:
        truncated = text[:MAX_RESPONSE_CHARS]
        note = (
            f"\n\n[Réponse tronquée à {MAX_RESPONSE_CHARS} caractères sur {len(text)}. "
            "Affine les paramètres (filtre, pagination) pour obtenir un résultat plus ciblé.]"
        )
        return truncated + note
    return text


async def load_endpoints() -> list[EndpointSpec]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_BASE_URL}/openapi.json", timeout=HTTP_TIMEOUT)
            response.raise_for_status()
        except Exception as exc:
            logger.error(
                "Impossible de récupérer le schéma OpenAPI depuis %s/openapi.json : %s. "
                "Vérifie que le backend GrowManager est démarré.",
                API_BASE_URL,
                exc,
            )
            raise
        spec = response.json()
    endpoints = build_endpoints(spec)
    mode = "lecture seule" if READONLY else "lecture + écriture"
    logger.info(
        "Serveur MCP GrowManager : %d outils (%s) générés depuis %s", len(endpoints), mode, API_BASE_URL
    )
    return endpoints


def _build_mcp_server(endpoints: list[EndpointSpec], http_client: httpx.AsyncClient) -> Server:
    endpoints_by_name = {e.tool_name: e for e in endpoints}
    tools = [endpoint_to_mcp_tool(e) for e in endpoints]

    server = Server("growmanager_mcp")

    @server.list_tools()
    async def handle_list_tools() -> list[types.Tool]:
        return tools

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict[str, Any] | None) -> list[types.TextContent]:
        endpoint = endpoints_by_name.get(name)
        if endpoint is None:
            return [types.TextContent(type="text", text=f"Erreur : outil inconnu '{name}'.")]
        result_text = await call_endpoint(http_client, endpoint, arguments or {})
        return [types.TextContent(type="text", text=result_text)]

    return server


async def run_stdio() -> None:
    endpoints = await load_endpoints()
    async with httpx.AsyncClient() as http_client:
        server = _build_mcp_server(endpoints, http_client)
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="growmanager_mcp",
                    server_version="1.0.0",
                    capabilities=server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )


async def run_http() -> None:
    if not MCP_TOKEN:
        logger.error(
            "GROWMANAGER_MCP_TOKEN n'est pas défini : refus de démarrer en mode http sans authentification "
            "(ce serveur écoute sur le réseau et peut modifier des données si le mode écriture est actif)."
        )
        sys.exit(1)

    # Import différé : uniquement nécessaire en mode http, pour ne pas imposer
    # uvicorn à l'installation stdio (Windows locale).
    import uvicorn
    from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

    endpoints = await load_endpoints()
    http_client = httpx.AsyncClient()
    server = _build_mcp_server(endpoints, http_client)
    session_manager = StreamableHTTPSessionManager(app=server, stateless=True)

    expected_auth_header = f"Bearer {MCP_TOKEN}"
    health_body = json.dumps(
        {"status": "ok", "outils": len(endpoints), "mode": "readonly" if READONLY else "read-write"}
    ).encode()

    async def send_json(send, status: int, body: bytes) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": body})

    # Application ASGI minimale, écrite à la main pour éviter toute surprise de
    # routage d'un framework tiers (redirections de slash, etc.) sur le chemin
    # critique de l'authentification.
    async def asgi_app(scope, receive, send):
        if scope["type"] == "lifespan":
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    await session_manager_cm.__aenter__()
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    await session_manager_cm.__aexit__(None, None, None)
                    await http_client.aclose()
                    await send({"type": "lifespan.shutdown.complete"})
                    return
            return

        if scope["type"] != "http":
            return

        path = scope.get("path", "")
        if path.rstrip("/") == "/healthz":
            await send_json(send, 200, health_body)
            return

        if path == "/mcp" or path.startswith("/mcp/"):
            headers = dict(scope.get("headers") or [])
            auth = headers.get(b"authorization", b"").decode("latin-1")
            if auth != expected_auth_header:
                await send_json(send, 401, b'{"error": "unauthorized"}')
                return
            await session_manager.handle_request(scope, receive, send)
            return

        await send_json(send, 404, b'{"error": "not found"}')

    session_manager_cm = session_manager.run()

    logger.info("Serveur MCP GrowManager en écoute sur http://%s:%d/mcp (auth par jeton requise)", HTTP_HOST, HTTP_PORT)
    config = uvicorn.Config(asgi_app, host=HTTP_HOST, port=HTTP_PORT, log_level="info")
    await uvicorn.Server(config).serve()


def main() -> None:
    try:
        if TRANSPORT == "http":
            asyncio.run(run_http())
        else:
            asyncio.run(run_stdio())
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        logger.error("Le serveur MCP GrowManager s'est arrêté sur une erreur : %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
