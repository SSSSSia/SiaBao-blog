# 云服务器数据自动备份到 GitHub

数据备份是服务器运维中不可忽视的一环。如果你想为服务器上的某个目录找一个免费、自带版本控制的备份方案，GitHub 是个不错的选择。本文档介绍如何通过 Shell 脚本 + Crontab 定时任务，实现每天自动将目录内容推送到 GitHub 仓库。

## 1. 前置准备

在开始写脚本之前，需要完成一些基础配置，确保后续的定时任务能无交互地顺利运行。

### 1.1 安装 Git

首先确认服务器上已经安装了 Git：

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install git -y

# CentOS/RHEL
sudo yum install git -y

# 验证安装
git --version
```

### 1.2 配置 GitHub SSH 免密登录

定时任务无法输入密码，因此必须配置 SSH 密钥认证。

**1. 生成密钥**

执行用户需与后续运行定时任务的用户一致，推荐用 root：

```bash
ssh-keygen -t ed25519 -C "你的GitHub邮箱"
# 一路回车即可，不要设置密钥密码
```

**2. 查看并复制公钥**

```bash
cat /root/.ssh/id_ed25519.pub
```

**3. 配置到 GitHub**

打开 GitHub → Settings → SSH and GPG keys → New SSH key，粘贴公钥并保存。

**4. 测试连通性**

```bash
ssh -T git@github.com
# 看到 "Hi 用户名! You've successfully authenticated..." 即为成功
```

### 1.3 初始化 Git 仓库

进入你要备份的目录，初始化 Git 并关联远程仓库：

```bash
cd /你的/备份目录/绝对路径

# 初始化仓库
git init

# 关联远程仓库（必须用 SSH 地址）
git remote add origin git@github.com:你的用户名/你的仓库名.git

# 配置 Git 用户信息
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub邮箱"

# 手动完成首次推送（确认流程通畅）
git add . && git commit -m "初始化备份" && git push -u origin main
```

## 2. 编写自动备份脚本

脚本是整个自动化流程的核心，完成"拉取 → 提交 → 推送"的全流程，并记录日志方便排查。

### 2.1 创建脚本文件

```bash
vim /root/auto_backup_to_github.sh
```

### 2.2 脚本内容

```bash
#!/bin/bash
####################################### 配置区域 #######################################
BACKUP_DIR="/你的/备份目录/绝对路径"  # 要备份的目录
LOG_FILE="/root/script_log/auto_git_backup.log" # 日志文件路径
BRANCH_NAME="main"                   # GitHub 分支名 (main/master)
COMMIT_PREFIX="服务器自动数据备份"     # 提交信息前缀
#######################################################################################

# 自动创建日志目录（防止报错）
mkdir -p $(dirname $LOG_FILE)

# 日志记录函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

log "==================== 备份任务启动 ===================="

# 1. 进入备份目录
cd $BACKUP_DIR
if [ $? -ne 0 ]; then
    log "【错误】无法进入目录: $BACKUP_DIR"
    exit 1
fi

# 2. 拉取远程最新代码（防冲突）
log "正在拉取远程代码..."
git pull origin $BRANCH_NAME

# 3. 添加所有变更
git add .

# 4. 提交变更（带时间戳）
COMMIT_MSG="${COMMIT_PREFIX} - $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MSG"
if [ $? -ne 0 ]; then
    log "【提示】当前无文件变更，无需备份"
    log "==================== 任务结束 ===================="
    exit 0
fi

# 5. 推送到 GitHub
log "正在推送到 GitHub..."
git push origin $BRANCH_NAME
if [ $? -ne 0 ]; then
    log "【错误】推送失败！"
    exit 1
fi

log "备份成功！"
log "==================== 任务结束 ===================="
exit 0
```

### 2.3 赋予执行权限

```bash
chmod +x /root/auto_backup_to_github.sh
```

## 3. 手动测试与定时配置

### 3.1 手动测试脚本

在配置定时任务前，务必手动执行一次，确保没有问题：

```bash
/bin/bash /root/auto_backup_to_github.sh

# 查看日志确认执行情况
cat /root/script_log/auto_git_backup.log
```

### 3.2 配置 Crontab 定时任务

使用 `crontab` 实现每天定时执行：

```bash
crontab -e
```

在文件末尾添加以下行（示例为每天凌晨 2 点执行）：

```bash
0 2 * * * /bin/bash /root/auto_backup_to_github.sh
```

保存退出后重启 cron 服务：

| 系统 | 命令 |
|------|------|
| Debian/Ubuntu | `sudo systemctl restart cron` |
| CentOS/RHEL | `sudo systemctl restart crond` |

## 4. 常见问题与安全建议

### 常见问题排查

**手动执行正常，Cron 执行失败**

- 检查执行用户是否一致（SSH 密钥是给哪个用户生成的）
- 脚本中的命令尽量使用绝对路径（可用 `which git` 查看路径）

**推送提示权限拒绝**

- 确认远程仓库地址是 `git@github.com:` 开头的 SSH 格式
- 检查 SSH 密钥权限：`chmod 700 ~/.ssh && chmod 600 ~/.ssh/id_ed25519`

### 安全优化建议

| 建议 | 说明 |
|------|------|
| 使用私有仓库 | 备份数据可能包含敏感信息，切勿使用公开仓库 |
| 配置 `.gitignore` | 排除日志、临时文件、`node_modules` 等无需备份的内容 |
| 日志轮转 | 长期运行日志会变大，可配置 `logrotate` 自动切割日志 |

---

通过这套方案，你就拥有了一个免费且强大的自动备份系统。GitHub 的版本控制能力还能让你随时回溯文件的历史变更，非常适合用来备份博客文章、配置文件等重要数据。
