export type OrgNodeDto = {
  id: string
  name: string
  parentId: string | null
  headcount: number
  budget: number
  performance: number
  updatedAt: string
}

export type NodeChange = {
  id: string
  headcount?: number
  budget?: number
  performance?: number
  updatedAt: string
}

export type NodeUpdatedEvent = { type: 'node.updated'; revision: number; changes: NodeChange[] }
export type HeartbeatEvent = { type: 'heartbeat'; revision: number }
export type StreamEvent = NodeUpdatedEvent | HeartbeatEvent
