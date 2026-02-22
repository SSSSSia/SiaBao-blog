#!/bin/bash
# 自动备份脚本

set -e

# 配置
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
DATA_DIR="${PROJECT_DIR}/server/data"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] 开始备份..."

# 备份数据目录
echo "[$(date)] 备份文章数据..."
tar -czf "${BACKUP_DIR}/data_${DATE}.tar.gz" -C "${PROJECT_DIR}" server/data/

# 备份环境配置（不包含敏感信息的副本）
echo "[$(date)] 备份配置文件..."
cp "${PROJECT_DIR}/server/.env" "${BACKUP_DIR}/.env_${DATE}.bak"

# 计算备份文件大小
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/data_${DATE}.tar.gz" | cut -f1)
echo "[$(date)] 备份完成: ${BACKUP_SIZE}"

# 清理旧备份
echo "[$(date)] 清理 ${RETENTION_DAYS} 天前的备份..."
find "${BACKUP_DIR}" -name "data_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name ".env_*.bak" -mtime +${RETENTION_DAYS} -delete

# 列出当前备份
echo "[$(date)] 当前备份列表:"
ls -lh "${BACKUP_DIR}"

echo "[$(date)] 备份任务完成"
