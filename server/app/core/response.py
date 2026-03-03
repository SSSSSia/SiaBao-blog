# -*- coding: utf-8 -*-
"""Unified API response format.

This module provides a standardized response structure for all API endpoints,
ensuring consistency across the application.
"""
from enum import Enum
from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field


class ResponseCode(str, Enum):
    """Response status codes."""

    SUCCESS = "200"
    FAIL = "400"
    UNAUTHORIZED = "401"
    FORBIDDEN = "403"
    NOT_FOUND = "404"
    ERROR = "500"


class R(BaseModel):
    """统一API响应格式

    Attributes:
        code: 响应状态码
        message: 响应消息
        data: 响应数据
    """

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        use_enum_values=True,
    )

    code: str = Field(default=ResponseCode.SUCCESS.value, description="响应状态码")
    message: str = Field(default="操作成功", description="响应消息")
    data: Any | None = Field(default=None, description="响应数据")

    @staticmethod
    def ok(message: str = "操作成功", data: Any = None, code: str | None = None) -> "R":
        """成功响应

        Args:
            message: 响应消息
            data: 响应数据
            code: 自定义状态码（可选）

        Returns:
            R: 响应对象
        """
        if code is None:
            code = ResponseCode.SUCCESS.value
        return R(code=code, message=message, data=data)

    @staticmethod
    def fail(message: str = "操作失败", data: Any = None, code: str | None = None) -> "R":
        """失败响应

        Args:
            message: 响应消息
            data: 响应数据
            code: 自定义状态码（可选）

        Returns:
            R: 响应对象
        """
        if code is None:
            code = ResponseCode.FAIL.value
        return R(code=code, message=message, data=data)

    @staticmethod
    def error(
        message: str,
        error_detail: str | None = None,
        code: str | None = None,
        data: Any = None,
    ) -> "R":
        """错误响应

        Args:
            message: 错误消息
            error_detail: 详细错误信息（可选）
            code: 自定义状态码（可选）
            data: 响应数据（可选）

        Returns:
            R: 响应对象
        """
        if code is None:
            code = ResponseCode.ERROR.value
        if data is not None:
            # 如果提供了data参数，直接使用
            return R(code=code, message=message, data=data)
        else:
            # 否则使用旧的逻辑（包含error_detail）
            final_data = {"error_detail": error_detail} if error_detail else None
            return R(code=code, message=message, data=final_data)

    @staticmethod
    def not_found(message: str = "资源不存在", data: Any = None) -> "R":
        """404 响应

        Args:
            message: 响应消息
            data: 响应数据

        Returns:
            R: 响应对象
        """
        return R(code=ResponseCode.NOT_FOUND.value, message=message, data=data)

    @staticmethod
    def unauthorized(message: str = "未授权", data: Any = None) -> "R":
        """401 响应

        Args:
            message: 响应消息
            data: 响应数据

        Returns:
            R: 响应对象
        """
        return R(code=ResponseCode.UNAUTHORIZED.value, message=message, data=data)

    @staticmethod
    def forbidden(message: str = "禁止访问", data: Any = None) -> "R":
        """403 响应

        Args:
            message: 响应消息
            data: 响应数据

        Returns:
            R: 响应对象
        """
        return R(code=ResponseCode.FORBIDDEN.value, message=message, data=data)

    def to_dict(self, **kwargs) -> dict:
        """转换为字典

        Args:
            **kwargs: 额外的参数传递给 model_dump

        Returns:
            dict: 字典格式的响应数据
        """
        return self.model_dump(**kwargs)


class RJSONResponse(JSONResponse):
    """统一格式的 JSON 响应

    继承自 FastAPI 的 JSONResponse，自动将 R 对象转换为 JSON 响应。
    """

    def render(self, content: Any) -> bytes:
        """渲染响应内容

        Args:
            content: 响应内容（R 对象或其他类型）

        Returns:
            bytes: JSON 字节串
        """
        if isinstance(content, R):
            return super().render(content.model_dump())
        return super().render(content)


def success_response(
    message: str = "操作成功",
    data: Any = None,
    status_code: int = 200,
) -> RJSONResponse:
    """成功响应的便捷函数

    Args:
        message: 响应消息
        data: 响应数据
        status_code: HTTP 状态码

    Returns:
        RJSONResponse: JSON 响应对象
    """
    return RJSONResponse(
        content=R.ok(message=message, data=data), status_code=status_code
    )


def fail_response(
    message: str = "操作失败",
    data: Any = None,
    status_code: int = 400,
) -> RJSONResponse:
    """失败响应的便捷函数

    Args:
        message: 响应消息
        data: 响应数据
        status_code: HTTP 状态码

    Returns:
        RJSONResponse: JSON 响应对象
    """
    return RJSONResponse(
        content=R.fail(message=message, data=data), status_code=status_code
    )


def error_response(
    message: str,
    error_detail: str | None = None,
    data: Any = None,
    status_code: int = 500,
) -> RJSONResponse:
    """错误响应的便捷函数

    Args:
        message: 错误消息
        error_detail: 详细错误信息
        data: 响应数据
        status_code: HTTP 状态码

    Returns:
        RJSONResponse: JSON 响应对象
    """
    return RJSONResponse(
        content=R.error(message=message, error_detail=error_detail, data=data),
        status_code=status_code,
    )


def not_found_response(
    message: str = "资源不存在",
    data: Any = None,
) -> RJSONResponse:
    """404 响应的便捷函数

    Args:
        message: 响应消息
        data: 响应数据

    Returns:
        RJSONResponse: JSON 响应对象
    """
    return RJSONResponse(
        content=R.not_found(message=message, data=data), status_code=404
    )


def unauthorized_response(
    message: str = "未授权",
    data: Any = None,
) -> RJSONResponse:
    """401 响应的便捷函数

    Args:
        message: 响应消息
        data: 响应数据

    Returns:
        RJSONResponse: JSON 响应对象
    """
    return RJSONResponse(
        content=R.unauthorized(message=message, data=data), status_code=401
    )


def forbidden_response(
    message: str = "禁止访问",
    data: Any = None,
) -> RJSONResponse:
    """403 响应的便捷函数

    Args:
        message: 响应消息
        data: 响应数据

    Returns:
        RJSONResponse: JSON 响应对象
    """
    return RJSONResponse(
        content=R.forbidden(message=message, data=data), status_code=403
    )


class APIException(HTTPException):
    """自定义 API 异常

    继承自 HTTPException，支持统一的响应格式。
    """

    def __init__(
        self,
        message: str,
        code: ResponseCode | None = None,
        data: Any = None,
        status_code: int = 400,
    ):
        """初始化异常

        Args:
            message: 错误消息
            code: 业务状态码
            data: 响应数据
            status_code: HTTP 状态码
        """
        self.message = message
        self.code = code
        self.data = data
        super().__init__(status_code=status_code, detail=message)

    def to_response(self) -> RJSONResponse:
        """转换为统一响应格式

        Returns:
            RJSONResponse: JSON 响应对象
        """
        response_code = self.code.value if self.code else str(self.status_code)
        return RJSONResponse(
            content=R(code=response_code, message=self.message, data=self.data),
            status_code=self.status_code,
        )
