# -*- coding: utf-8 -*-
"""Global exception handlers for unified response format.

This module provides exception handlers that convert all exceptions
into the unified R response format.
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.response import R, RJSONResponse


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> RJSONResponse:
    """Handle HTTPException and return unified response format.

    Args:
        request: FastAPI request object
        exc: HTTPException instance

    Returns:
        RJSONResponse: Unified format response
    """
    # Map HTTP status codes to response codes
    status_code = exc.status_code

    # Determine message
    message = exc.detail if exc.detail else "请求失败"

    # Map common status codes to specific response types
    if status_code == 401:
        return RJSONResponse(
            content=R.unauthorized(message=message),
            status_code=status_code,
        )
    elif status_code == 403:
        return RJSONResponse(
            content=R.forbidden(message=message),
            status_code=status_code,
        )
    elif status_code == 404:
        return RJSONResponse(
            content=R.not_found(message=message),
            status_code=status_code,
        )
    elif status_code >= 500:
        return RJSONResponse(
            content=R.error(message=message),
            status_code=status_code,
        )
    else:
        return RJSONResponse(
            content=R.fail(message=message),
            status_code=status_code,
        )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> RJSONResponse:
    """Handle RequestValidationError and return unified response format.

    Args:
        request: FastAPI request object
        exc: RequestValidationError instance

    Returns:
        RJSONResponse: Unified format response
    """
    # Extract validation errors
    errors = exc.errors()

    # Format error messages
    error_details = []
    for error in errors:
        location = " -> ".join(str(loc) for loc in error["loc"])
        error_details.append(f"{location}: {error['msg']}")

    error_message = "请求参数验证失败"
    if error_details:
        error_message += f" ({'; '.join(error_details)})"

    return RJSONResponse(
        content=R.fail(message=error_message, data={"errors": errors}),
        status_code=422,
    )


async def general_exception_handler(request: Request, exc: Exception) -> RJSONResponse:
    """Handle all other exceptions and return unified response format.

    Args:
        request: FastAPI request object
        exc: Exception instance

    Returns:
        RJSONResponse: Unified format response
    """
    # Log the exception in production
    # logger.exception(f"Unhandled exception: {exc}")

    return RJSONResponse(
        content=R.error(message=f"服务器内部错误: {str(exc)}"),
        status_code=500,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers with the FastAPI app.

    Args:
        app: FastAPI application instance
    """
    # Handle HTTPException
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # Handle RequestValidationError
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # Handle all other exceptions
    app.add_exception_handler(Exception, general_exception_handler)
