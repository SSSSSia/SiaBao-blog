/**
 * AI 前沿展区
 */

import { AI_TRENDS_DATA } from '../../../constants/exploreData'

export default function AITrends() {
  return (
    <div className="explore-card-grid">
      {AI_TRENDS_DATA.map((item) => (
        <div key={item.id} className={`explore-content-card${item.highlight ? ' highlight' : ''}`}>
          <h3 className="explore-card-title">{item.title}</h3>
          <p className="explore-card-desc">{item.desc}</p>
          <div className="explore-card-meta">
            <div className="explore-card-tags">
              {item.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <span className="explore-card-date">{item.date}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
