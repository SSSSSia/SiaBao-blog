#!/bin/bash
# 云服务器备份脚本 - 支持双仓库架构
# 用途: 备份博客数据和配置

set -e

# ==================== 配置区域 ====================
# 项目目录
DEPLOY_BASE_DIR="/blog"
CONTENT_DIR="${DEPLOY_BASE_DIR}/sia-blog-content"
PROJECT_DIR="${DEPLOY_BASE_DIR}/SiaBao-blog"

# 备份目录
BACKUP_BASE_DIR="${CONTENT_DIR}/backups"
BACKUP_DIR="${BACKUP_BASE_DIR}/$(date +%Y%m)"
mkdir -p "${BACKUP_DIR}"

# 数据目录
DATA_DIR="${CONTENT_DIR}/server/data"

# 保留天数
RETENTION_DAYS=30

# 备份日期
DATE=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)

# 日志文件
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup_${DATE}.log"

# 创建日志目录
mkdir -p "${LOG_DIR}"

# ==================== 日志函数 ====================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_info() {
    echo -e "\033[0;34m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [INFO] $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "\033[0;32m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [SUCCESS] $1" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "\033[1;33m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [WARNING] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "\033[0;31m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m [ERROR] $1" | tee -a "${LOG_FILE}"
}

# ==================== 备份函数 ====================
backup_data() {
    log_info "备份数据目录..."

    local backup_file="${BACKUP_DIR}/data_${DATE}.tar.gz"

    if [ -d "${DATA_DIR}" ]; then
        tar -czf "${backup_file}" -C "${CONTENT_DIR}/server" data

        local size=$(du -sh "${backup_file}" | cut -f1)
        log_success "数据备份完成: ${backup_file} (${size})"

        # 记录到备份索引
        echo "${DATE_ONLY}|data|${backup_file}|${size}" >> "${BACKUP_BASE_DIR}/backup_index.txt"
    else
        log_warning "数据目录不存在: ${DATA_DIR}"
    fi
}

backup_database() {
    log_info "备份数据库..."

    # SQLite 数据库备份
    if [ -f "${DATA_DIR}/blog.db" ]; then
        local backup_file="${BACKUP_DIR}/blog_${DATE}.db"
        cp "${DATA_DIR}/blog.db" "${backup_file}"

        local size=$(du -sh "${backup_file}" | cut -f1)
        log_success "数据库备份完成: ${backup_file} (${size})"

        # 记录到备份索引
        echo "${DATE_ONLY}|database|${backup_file}|${size}" >> "${BACKUP_BASE_DIR}/backup_index.txt"
    fi

    # PostgreSQL/MySQL 备份（如果使用）
    # if command -v pg_dump &> /dev/null; then
    #     pg_dump -U username database_name > "${BACKUP_DIR}/postgres_${DATE}.sql"
    # fi
}

backup_config() {
    log_info "备份配置文件..."

    # 环境变量备份
    if [ -f "${CONTENT_DIR}/server/.env" ]; then
        local backup_file="${BACKUP_DIR}/env_${DATE}.bak"
        cp "${CONTENT_DIR}/server/.env" "${backup_file}"

        local size=$(du -sh "${backup_file}" | cut -f1)
        log_success "环境配置备份完成: ${backup_file} (${size})"

        # 记录到备份索引
        echo "${DATE_ONLY}|config|${backup_file}|${size}" >> "${BACKUP_BASE_DIR}/backup_index.txt"
    fi

    # Nginx 配置备份
    if [ -d "${PROJECT_DIR}/docker/nginx" ]; then
        local backup_file="${BACKUP_DIR}/nginx_${DATE}.tar.gz"
        tar -czf "${backup_file}" -C "${PROJECT_DIR}/docker" nginx

        local size=$(du -sh "${backup_file}" | cut -f1)
        log_success "Nginx 配置备份完成: ${backup_file} (${size})"

        echo "${DATE_ONLY}|config|${backup_file}|${size}" >> "${BACKUP_BASE_DIR}/backup_index.txt"
    fi
}

backup_uploads() {
    log_info "备份上传文件..."

    if [ -d "${DATA_DIR}/uploads" ]; then
        local backup_file="${BACKUP_DIR}/uploads_${DATE}.tar.gz"

        # 只备份当月的上传文件
        local current_month=$(date +%Y%m)
        find "${DATA_DIR}/uploads" -type f -newermt "${current_month}-01" | \
            tar -czf "${backup_file}" -T -

        local size=$(du -sh "${backup_file}" | cut -f1)
        log_success "上传文件备份完成: ${backup_file} (${size})"

        echo "${DATE_ONLY}|uploads|${backup_file}|${size}" >> "${BACKUP_BASE_DIR}/backup_index.txt"
    fi
}

cleanup_old_backups() {
    log_info "清理旧备份文件..."

    # 清理超过保留天数的备份
    find "${BACKUP_BASE_DIR}" -name "data_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
    find "${BACKUP_BASE_DIR}" -name "blog_*.db" -mtime +${RETENTION_DAYS} -delete
    find "${BACKUP_BASE_DIR}" -name "env_*.bak" -mtime +${RETENTION_DAYS} -delete
    find "${BACKUP_BASE_DIR}" -name "nginx_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
    find "${BACKUP_BASE_DIR}" -name "uploads_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

    # 清理空目录
    find "${BACKUP_BASE_DIR}" -type d -empty -delete

    log_success "已清理 ${RETENTION_DAYS} 天前的备份"
}

generate_backup_report() {
    log_info "生成备份报告..."

    local report_file="${BACKUP_BASE_DIR}/backup_report_${DATE}.txt"

    {
        echo "=========================================="
        echo "  备份报告 - ${DATE}"
        echo "=========================================="
        echo ""
        echo "备份目录: ${BACKUP_DIR}"
        echo ""

        echo "--- 本月备份文件 ---"
        ls -lh "${BACKUP_DIR}" 2>/dev/null || echo "无备份文件"
        echo ""

        echo "--- 备份统计 ---"
        echo "数据备份: $(find "${BACKUP_BASE_DIR}" -name "data_*.tar.gz" -mtime -30 | wc -l) 个"
        echo "数据库备份: $(find "${BACKUP_BASE_DIR}" -name "blog_*.db" -mtime -30 | wc -l) 个"
        echo "配置备份: $(find "${BACKUP_BASE_DIR}" -name "env_*.bak" -o -name "nginx_*.tar.gz" -mtime -30 | wc -l) 个"
        echo ""

        echo "--- 磁盘使用 ---"
        du -sh "${BACKUP_BASE_DIR}" 2>/dev/null || echo "无法计算"
        echo ""

        echo "--- 最近备份记录 ---"
        tail -10 "${BACKUP_BASE_DIR}/backup_index.txt" 2>/dev/null || echo "无记录"
        echo ""

    } > "${report_file}"

    log_success "备份报告已生成: ${report_file}"
}

# ==================== 恢复函数 ====================
restore_backup() {
    local backup_type=$1
    local backup_file=$2

    if [ -z "${backup_file}" ]; then
        log_error "请指定备份文件路径"
        exit 1
    fi

    if [ ! -f "${backup_file}" ]; then
        log_error "备份文件不存在: ${backup_file}"
        exit 1
    fi

    log_warning "恢复操作将覆盖现有数据，请确认"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "恢复操作已取消"
        exit 0
    fi

    case "${backup_type}" in
        data)
            log_info "恢复数据目录..."
            tar -xzf "${backup_file}" -C "${CONTENT_DIR}/server"
            log_success "数据目录恢复完成"
            ;;
        database)
            log_info "恢复数据库..."
            cp "${backup_file}" "${DATA_DIR}/blog.db"
            log_success "数据库恢复完成"
            ;;
        config)
            log_info "恢复配置文件..."
            if [[ "${backup_file}" == *.bak ]]; then
                cp "${backup_file}" "${CONTENT_DIR}/server/.env"
            elif [[ "${backup_file}" == *.tar.gz ]]; then
                tar -xzf "${backup_file}" -C "${PROJECT_DIR}/docker"
            fi
            log_success "配置文件恢复完成"
            ;;
        *)
            log_error "未知备份类型: ${backup_type}"
            log_info "支持的类型: data, database, config"
            exit 1
            ;;
    esac

    log_info "请重启服务以应用恢复的数据"
}

list_backups() {
    log_info "可用备份列表："
    echo ""

    echo "--- 数据备份 ---"
    find "${BACKUP_BASE_DIR}" -name "data_*.tar.gz" -exec ls -lh {} \; 2>/dev/null | awk '{print $9, $5}'
    echo ""

    echo "--- 数据库备份 ---"
    find "${BACKUP_BASE_DIR}" -name "blog_*.db" -exec ls -lh {} \; 2>/dev/null | awk '{print $9, $5}'
    echo ""

    echo "--- 配置备份 ---"
    find "${BACKUP_BASE_DIR}" -name "env_*.bak" -o -name "nginx_*.tar.gz" -exec ls -lh {} \; 2>/dev/null | awk '{print $9, $5}'
    echo ""
}

# ==================== 主流程 ====================
main() {
    log "=========================================="
    log "  开始备份任务"
    log "=========================================="
    log ""

    # 执行备份
    backup_data
    backup_database
    backup_config
    backup_uploads

    # 清理旧备份
    cleanup_old_backups

    # 生成报告
    generate_backup_report

    log ""
    log "=========================================="
    log_success "备份任务完成"
    log "=========================================="
    log ""
    log "备份目录: ${BACKUP_DIR}"
    log "日志文件: ${LOG_FILE}"
    log ""
}

# ==================== 脚本入口 ====================
print_usage() {
    echo "用法: $0 [选项] [参数]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -l, --list              列出所有备份"
    echo "  -r, --restore <类型>    恢复备份 (data|database|config)"
    echo "  <备份文件路径>"
    echo ""
    echo "示例:"
    echo "  $0                      # 执行备份"
    echo "  $0 -l                   # 列出备份"
    echo "  $0 -r data /opt/blog/sia-blog-content/backups/20241222/data_20241222_120000.tar.gz"
    echo ""
}

# 解析命令行参数
case "${1:-}" in
    -h|--help)
        print_usage
        exit 0
        ;;
    -l|--list)
        list_backups
        ;;
    -r|--restore)
        if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
            log_error "恢复操作需要指定类型和备份文件"
            print_usage
            exit 1
        fi
        restore_backup "$2" "$3"
        ;;
    "")
        main
        ;;
    *)
        echo "未知选项: $1"
        print_usage
        exit 1
        ;;
esac
