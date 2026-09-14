import { performanceLevel } from '@/app/theme'
import type { OrgTreeNode } from '@/entities/org/buildTree'
import { ChildrenList, HeadcountBadge, NodeName, NodeRow, PerformanceIndicator, ToggleButton } from './TreeNode.styles'

const headcountFormatter = new Intl.NumberFormat('ru-RU')

export function TreeNode({
  node,
  isExpanded,
  onToggle,
}: {
  node: OrgTreeNode
  isExpanded: (id: string) => boolean
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const expanded = isExpanded(node.id)
  const level = performanceLevel(node.performance)

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <NodeRow>
        <ToggleButton
          type="button"
          $expanded={expanded}
          $visible={hasChildren}
          disabled={!hasChildren}
          aria-label={expanded ? `Свернуть «${node.name}»` : `Развернуть «${node.name}»`}
          onClick={() => onToggle(node.id)}
        >
          ▶
        </ToggleButton>
        <NodeName title={node.name}>{node.name}</NodeName>
        <HeadcountBadge>{headcountFormatter.format(node.headcount)} чел.</HeadcountBadge>
        {/* Color is never the sole carrier of meaning: the number is always rendered too. */}
        <PerformanceIndicator $level={level} aria-label={`Эффективность: ${node.performance} из 100`}>
          {node.performance}
        </PerformanceIndicator>
      </NodeRow>
      {hasChildren && expanded && (
        <ChildrenList role="group">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} isExpanded={isExpanded} onToggle={onToggle} />
          ))}
        </ChildrenList>
      )}
    </li>
  )
}
