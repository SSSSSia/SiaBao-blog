#!/bin/bash
# Unix/Linux/macOS 启动脚本

echo "Starting My Blog Server..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
