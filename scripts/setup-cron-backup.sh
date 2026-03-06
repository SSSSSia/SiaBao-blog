#!/bin/bash
# 安装定时备份任务的脚本
# 用法: sudo bash setup-cron-backup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-content.sh"
CONTENT_DIR="/root/blog/sia-blog-content"
CRON_FILE="/etc/cron.d/content-backup"

echo "=== Installing Automatic Content Backup ==="
echo ""

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# 检查备份脚本是否存在
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "Error: Backup script not found: $BACKUP_SCRIPT"
    exit 1
fi

# 给备份脚本添加执行权限
echo "Setting executable permissions on backup script..."
chmod +x "$BACKUP_SCRIPT"

# 检查内容目录是否存在
if [ ! -d "$CONTENT_DIR" ]; then
    echo "⚠️  Warning: Content directory not found: $CONTENT_DIR"
    echo "Please ensure the directory exists before setting up the cron job."
    exit 1
fi

echo "✓ Content directory found: $CONTENT_DIR"

# 创建 cron 任务
# 每周日凌晨 2:00 执行备份
echo "Creating cron job..."
cat > "$CRON_FILE" <<EOF
# 内容仓库自动备份任务
# 每周日凌晨 2:00 执行
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 2 * * 0 root $BACKUP_SCRIPT >> /var/log/content-backup.log 2>&1
EOF

# 设置正确的权限
chmod 644 "$CRON_FILE"

echo "✓ Cron job installed: $CRON_FILE"

# 重启 cron 服务
echo "Reloading cron service..."
if command -v systemctl >/dev/null 2>&1; then
    systemctl reload cron 2>/dev/null || systemctl reload crond 2>/dev/null
elif command -v service >/dev/null 2>&1; then
    service cron reload 2>/dev/null || service crond reload 2>/dev/null
fi

echo "✓ Cron service reloaded"

# 验证 cron 任务
echo ""
echo "=== Installed Cron Jobs ==="
cat "$CRON_FILE"
echo ""
echo "=== Cron Job List ==="
crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" || echo "No user cron jobs (system cron job is active)"

echo ""
echo "=========================================="
echo "✓ Setup Complete!"
echo ""
echo "Cron job details:"
echo "  - Schedule: Every Sunday at 2:00 AM"
echo "  - Script: $BACKUP_SCRIPT"
echo "  - Log: /var/log/content-backup.log"
echo ""
echo "To test the backup script manually:"
echo "  sudo bash $BACKUP_SCRIPT"
echo ""
echo "To view backup logs:"
echo "  sudo tail -f /var/log/content-backup.log"
echo ""
echo "To edit the schedule:"
echo "  sudo nano $CRON_FILE"
echo "  (After editing, reload: sudo systemctl reload cron)"
echo "=========================================="
