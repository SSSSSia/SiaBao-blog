/**
 * 开发者工具箱展区
 */

import { DEV_TOOLS_DATA } from '../../../constants/exploreData'

export default function DevTools() {
  return (
    <div>
      {DEV_TOOLS_DATA.map((group, groupIdx) => (
        <div key={group.category} className="explore-tools-group">
          <h4 className="explore-tools-category">{group.category}</h4>
          <div className="explore-tools-list">
            {group.items.map((tool) => (
              <div
                key={tool.name}
                className="explore-tool-item"
                style={{ animationDelay: `${groupIdx * 0.1 + 0.05}s` }}
              >
                <span className="explore-tool-name">{tool.name}</span>
                <span className="explore-tool-desc">{tool.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
