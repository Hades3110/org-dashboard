import type { OrgTreeNode } from '@/entities/org/buildTree'
import type { Freshness } from '@/entities/org/patch'
import { formatHeadcount } from '@/shared/formatters/format'
import { useFreshHighlight } from '@/shared/hooks/useFreshHighlight'
import { PerformanceIndicator } from '@/shared/ui/PerformanceIndicator'
import { ChildrenList, ExpandableInner, ExpandableRegion, HeadcountBadge, NodeName, NodeRow, ToggleButton } from './TreeNode.styles'

export function TreeNode({
  node,
  isExpanded,
  onToggle,
  selectedId,
  registerNode,
  freshness,
}: {
  node: OrgTreeNode
  isExpanded: (id: string) => boolean
  onToggle: (id: string) => void
  selectedId: string | null
  registerNode: (id: string) => (el: HTMLLIElement | null) => void
  freshness: Freshness
}) {
  const hasChildren = node.children.length > 0
  const expanded = isExpanded(node.id)
  const selected = node.id === selectedId

  const fields = freshness.get(node.id)
  const headcountFresh = useFreshHighlight(fields?.headcount ?? null)
  const performanceFresh = useFreshHighlight(fields?.performance ?? null)

  return (
    <li ref={registerNode(node.id)} role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selected}>
      <NodeRow $selected={selected}>
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
        <HeadcountBadge $isFresh={headcountFresh}>{formatHeadcount(node.headcount)}</HeadcountBadge>
        <PerformanceIndicator
          value={node.performance}
          ariaLabel={`Эффективность: ${node.performance} из 100`}
          isFresh={performanceFresh}
        />
      </NodeRow>
      {hasChildren && (
        <ExpandableRegion $expanded={expanded}>
          <ExpandableInner>
            <ChildrenList role="group">
              {node.children.map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  isExpanded={isExpanded}
                  onToggle={onToggle}
                  selectedId={selectedId}
                  registerNode={registerNode}
                  freshness={freshness}
                />
              ))}
            </ChildrenList>
          </ExpandableInner>
        </ExpandableRegion>
      )}
    </li>
  )
}
