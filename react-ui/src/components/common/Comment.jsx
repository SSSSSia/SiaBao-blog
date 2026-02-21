import { useState } from 'react'
import { MessageCircle, Heart, Send, User } from 'lucide-react'
import './Comment.css'

function formatRelativeTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
}

function CommentItem({ comment, onLike, onReply, depth = 0, maxDepth = 2 }) {
  const [isLiked, setIsLiked] = useState(false)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyContent, setReplyContent] = useState('')

  const handleLike = () => {
    setIsLiked((prev) => !prev)
    onLike?.(comment.id)
  }

  const handleReply = () => {
    if (!replyContent.trim()) return
    onReply?.(replyContent, comment.id)
    setReplyContent('')
    setShowReplyInput(false)
  }

  const canReply = depth < maxDepth

  return (
    <div
      className={`comment-item ${depth > 0 ? 'comment-item-nested' : ''}`}
      style={{ '--comment-depth': depth }}
    >
      <div className='comment-header'>
        <div className='comment-author'>
          {comment.author?.avatar ? (
            <img
              src={comment.author.avatar}
              alt={comment.author.name}
              className='comment-avatar'
            />
          ) : (
            <div className='comment-avatar-placeholder'>
              <User size={16} />
            </div>
          )}
          <span className='comment-author-name'>
            {comment.author?.name || '匿名用户'}
          </span>
        </div>
        <span className='comment-time'>{formatRelativeTime(comment.createdAt)}</span>
      </div>

      <div className='comment-content'>{comment.content}</div>

      <div className='comment-actions'>
        <button
          className={`comment-action ${isLiked ? 'comment-action-liked' : ''}`}
          onClick={handleLike}
        >
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{comment.likes || 0}</span>
        </button>

        {canReply && (
          <button
            className='comment-action'
            onClick={() => setShowReplyInput((prev) => !prev)}
          >
            <MessageCircle size={14} />
            <span>回复</span>
          </button>
        )}
      </div>

      {showReplyInput && canReply && (
        <div className='comment-reply-box'>
          <textarea
            className='comment-reply-input'
            placeholder='写下你的回复...'
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={2}
            autoFocus
          />
          <div className='comment-reply-actions'>
            <button
              className='comment-reply-cancel'
              onClick={() => {
                setShowReplyInput(false)
                setReplyContent('')
              }}
            >
              取消
            </button>
            <button
              className='comment-reply-submit'
              onClick={handleReply}
              disabled={!replyContent.trim()}
            >
              <Send size={14} />
              发送
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && depth < maxDepth && (
        <div className='comment-replies'>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onLike={onLike}
              onReply={onReply}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Comment({ comments = [], onPost, onLike }) {
  const [newComment, setNewComment] = useState('')

  const handlePostComment = () => {
    if (!newComment.trim()) return
    onPost?.(newComment)
    setNewComment('')
  }

  const topLevelComments = comments.filter((comment) => !comment.parentId)

  return (
    <div className='comment-section'>
      <h3 className='comment-title'>
        <MessageCircle size={20} />
        评论
        <span className='comment-count'>({comments.length})</span>
      </h3>

      <div className='comment-post'>
        <textarea
          className='comment-post-input'
          placeholder='发表你的看法...'
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        <div className='comment-post-actions'>
          <span className='comment-post-tip'>按 Ctrl+Enter 快速发布</span>
          <button
            className='comment-post-submit'
            onClick={handlePostComment}
            disabled={!newComment.trim()}
          >
            <Send size={16} />
            发布评论
          </button>
        </div>
      </div>

      <div className='comment-list'>
        {topLevelComments.length > 0 ? (
          topLevelComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onLike={onLike}
              onReply={onPost}
              maxDepth={2}
            />
          ))
        ) : (
          <div className='comment-empty'>
            <MessageCircle size={48} />
            <p>暂无评论，快来发表第一条评论吧！</p>
          </div>
        )}
      </div>
    </div>
  )
}
