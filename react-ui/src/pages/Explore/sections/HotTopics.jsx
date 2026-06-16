/**
 * 热门话题展区
 */

import { HOT_TOPICS_DATA } from '../../../constants/exploreData'

export default function HotTopics() {
  return (
    <div className="explore-card-grid">
      {HOT_TOPICS_DATA.map((item) => (
        <div key={item.id} className="explore-content-card">
          <h3 className="explore-card-title">{item.title}</h3>
          <p className="explore-card-desc">{item.desc}</p>
          <div className="explore-card-tags">
            {item.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
