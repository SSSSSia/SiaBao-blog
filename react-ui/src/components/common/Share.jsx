/**
 * 分享组件
 * 支持微信扫码、链接复制
 */

import { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
} from 'lucide-react';
import './Share.css';

// eslint-disable-next-line no-unused-vars
export default function Share({ title, url }) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // 复制链接
  const handleCopyLink = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 生成二维码（使用第三方API）
  const qrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

  return (
    <>
      <button
        className="share-button"
        onClick={() => setShowModal(true)}
        title="分享文章"
      >
        <Share2 size={18} />
        <span>分享</span>
      </button>

      {showModal && (
        <div className="share-modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="share-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 模态框头部 */}
            <div className="share-modal-header">
              <h3 className="share-modal-title">分享文章</h3>
              <button
                className="share-modal-close"
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* 分享方式 */}
            <div className="share-modal-body">
              {/* 复制链接 */}
              <div className="share-section">
                <h4 className="share-section-title">复制链接</h4>
                <div className="share-link-box">
                  <input
                    type="text"
                    className="share-link-input"
                    value={url}
                    readOnly
                  />
                  <button
                    className={`share-link-copy ${copied ? 'share-link-copy-copied' : ''}`}
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <>
                        <Check size={16} />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        复制
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 微信扫码 */}
              <div className="share-section">
                <h4 className="share-section-title">微信扫码</h4>
                <div className="share-qrcode">
                  <img src={qrcodeUrl} alt="分享二维码" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
