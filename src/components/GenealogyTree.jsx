import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'

export function GenealogyTree({ entityId, edges = [], onNavigateEntity }) {
  const boardRef = useRef(null)
  const nodeRefs = useRef(new Map())
  const [connectors, setConnectors] = useState({ width: 0, height: 0, paths: [] })

  const { rows, hasCycle } = useMemo(() => {
    const nodeMap = new Map()
    const incomingCount = new Map()
    const outgoing = new Map()
    const depth = new Map()

    for (const edge of edges) {
      nodeMap.set(edge.parentId, {
        id: edge.parentId,
        batchId: edge.parentBatchId,
        type: edge.parentType,
      })
      nodeMap.set(edge.childId, {
        id: edge.childId,
        batchId: edge.childBatchId,
        type: edge.childType,
      })
      incomingCount.set(edge.childId, (incomingCount.get(edge.childId) || 0) + 1)
      incomingCount.set(edge.parentId, incomingCount.get(edge.parentId) || 0)
      const children = outgoing.get(edge.parentId) || []
      children.push(edge.childId)
      outgoing.set(edge.parentId, children)
    }

    const ready = [...nodeMap.values()]
      .filter((node) => incomingCount.get(node.id) === 0)
      .sort((left, right) => left.batchId.localeCompare(right.batchId))
    for (const node of ready) depth.set(node.id, 0)

    let processed = 0
    while (ready.length) {
      const node = ready.shift()
      processed += 1
      for (const childId of outgoing.get(node.id) || []) {
        depth.set(childId, Math.max(depth.get(childId) || 0, (depth.get(node.id) || 0) + 1))
        const remainingIncoming = incomingCount.get(childId) - 1
        incomingCount.set(childId, remainingIncoming)
        if (remainingIncoming === 0) {
          ready.push(nodeMap.get(childId))
          ready.sort((left, right) => left.batchId.localeCompare(right.batchId))
        }
      }
    }

    if (processed !== nodeMap.size) return { rows: [], nodes: nodeMap, hasCycle: true }

    const maxDepth = Math.max(0, ...depth.values())
    const graphRows = Array.from({ length: maxDepth + 1 }, () => [])
    for (const node of nodeMap.values()) {
      graphRows[depth.get(node.id)].push(node)
    }
    graphRows.forEach((row) => row.sort((left, right) => left.batchId.localeCompare(right.batchId)))
    return { rows: graphRows, nodes: nodeMap, hasCycle: false }
  }, [edges])

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return undefined

    const updateConnectors = () => {
      const bounds = board.getBoundingClientRect()
      const paths = edges.flatMap((edge) => {
        const parent = nodeRefs.current.get(edge.parentId)?.getBoundingClientRect()
        const child = nodeRefs.current.get(edge.childId)?.getBoundingClientRect()
        if (!parent || !child) return []
        const startX = parent.left + parent.width / 2 - bounds.left
        const startY = parent.bottom - bounds.top
        const endX = child.left + child.width / 2 - bounds.left
        const endY = child.top - bounds.top
        const middleY = startY + (endY - startY) / 2
        return [`M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}`]
      })
      setConnectors({ width: bounds.width, height: bounds.height, paths })
    }

    updateConnectors()
    const observer = new ResizeObserver(updateConnectors)
    observer.observe(board)
    return () => observer.disconnect()
  }, [edges, rows])

  if (edges.length === 0) {
    return <p className="detail-muted">No material links.</p>
  }
  if (hasCycle) {
    return <p className="detail-muted">Genealogy links contain a cycle and cannot be displayed.</p>
  }

  return (
    <div className="genealogy-flow-scroll">
      <div className="genealogy-flow-board" ref={boardRef}>
        <svg
          className="genealogy-flow-connectors"
          width={connectors.width}
          height={connectors.height}
          aria-hidden="true"
        >
          <defs>
            <marker
              id="genealogy-arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="4"
              refY="3"
              orient="auto"
            >
              <path d="M 0 0 L 6 3 L 0 6 z" />
            </marker>
          </defs>
          {connectors.paths.map((path, index) => (
            <path key={`${index}-${path}`} d={path} markerEnd="url(#genealogy-arrowhead)" />
          ))}
        </svg>
        {rows.map((row, rowIndex) => (
          <div className="genealogy-flow-row" key={rowIndex}>
            {row.map((node) => (
              <button
                key={node.id}
                ref={(element) => {
                  if (element) nodeRefs.current.set(node.id, element)
                  else nodeRefs.current.delete(node.id)
                }}
                type="button"
                className={`genealogy-flow-node ${node.id === entityId ? 'current' : ''}`}
                aria-current={node.id === entityId ? 'page' : undefined}
                aria-label={`${node.batchId}, ${node.type?.replace('_', ' ') || 'batch'}`}
                onClick={() => node.id !== entityId && onNavigateEntity(node.id)}
              >
                {node.batchId}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
