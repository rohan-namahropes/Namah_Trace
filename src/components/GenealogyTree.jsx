import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Minus, Plus, Maximize, X } from 'lucide-react'

const typeLabels = {
  flat_yarn: 'Flat Yarn',
  yarn: 'Yarn',
  rope: 'Rope',
}

function makeRows(edges, entityId, rootBatchId) {
  const nodes = new Map()
  const incomingCount = new Map()
  const outgoing = new Map()
  const adjacent = new Map()
  const depth = new Map()

  for (const edge of edges) {
    nodes.set(edge.parentId, {
      id: edge.parentId,
      batchId: edge.parentBatchId,
      type: edge.parentType,
    })
    nodes.set(edge.childId, {
      id: edge.childId,
      batchId: edge.childBatchId,
      type: edge.childType,
    })
    incomingCount.set(edge.childId, (incomingCount.get(edge.childId) || 0) + 1)
    incomingCount.set(edge.parentId, incomingCount.get(edge.parentId) || 0)
    const children = outgoing.get(edge.parentId) || []
    children.push(edge.childId)
    outgoing.set(edge.parentId, children)
    for (const [from, to] of [[edge.parentId, edge.childId], [edge.childId, edge.parentId]]) {
      const neighbors = adjacent.get(from) || []
      neighbors.push(to)
      adjacent.set(from, neighbors)
    }
  }
  if (!nodes.has(entityId)) nodes.set(entityId, { id: entityId, batchId: rootBatchId, type: '' })

  const ready = [...nodes.values()]
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
        ready.push(nodes.get(childId))
        ready.sort((left, right) => left.batchId.localeCompare(right.batchId))
      }
    }
  }
  if (processed !== nodes.size) return { rows: [], hasCycle: true }

  const rows = Array.from({ length: Math.max(0, ...depth.values()) + 1 }, () => [])
  for (const node of nodes.values()) rows[depth.get(node.id) || 0].push(node)
  rows.forEach((row) => row.sort((left, right) => left.batchId.localeCompare(right.batchId)))
  for (let pass = 0; pass < 4; pass += 1) {
    for (const rowIndex of [
      ...rows.map((_, index) => index),
      ...rows.map((_, index) => rows.length - index - 1),
    ]) {
      const positions = new Map(
        rows.flatMap((row) => row.map((node, index) => [node.id, index]))
      )
      const currentPositions = new Map(rows[rowIndex].map((node, index) => [node.id, index]))
      rows[rowIndex].sort((left, right) => {
        const score = (node) => {
          const neighbors = adjacent.get(node.id) || []
          if (!neighbors.length) return currentPositions.get(node.id)
          return neighbors.reduce((sum, id) => sum + (positions.get(id) ?? 0), 0) / neighbors.length
        }
        return score(left) - score(right) || left.batchId.localeCompare(right.batchId)
      })
    }
  }
  return { rows, hasCycle: false }
}

function formatAllocation(edge) {
  if (edge.quantityUsed == null) return ''
  return `${edge.quantityUsed} ${edge.unit || ''}`.trim()
}

export function GenealogyTree({
  entityId,
  batchId,
  edges = [],
  onNavigateEntity,
  onLoadFullGenealogy,
}) {
  const viewportRef = useRef(null)
  const boardRef = useRef(null)
  const nodeRefs = useRef(new Map())
  const miniBoardRef = useRef(null)
  const miniNodeRefs = useRef(new Map())
  const centerOnOpenRef = useRef(false)
  const [connectors, setConnectors] = useState({ width: 0, height: 0, paths: [] })
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [miniConnectors, setMiniConnectors] = useState({ width: 0, height: 0, paths: [] })
  const [open, setOpen] = useState(false)
  const [graphEdges, setGraphEdges] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [visibleGenerations, setVisibleGenerations] = useState(1)
  const [visibleNodeLimit, setVisibleNodeLimit] = useState(25)
  const [zoom, setZoom] = useState(1)

  const miniEdges = useMemo(() => edges.filter((edge) => (
    edge.parentId === entityId || edge.childId === entityId
  )), [edges, entityId])
  const miniRows = useMemo(() => makeRows(miniEdges, entityId, batchId).rows, [miniEdges, entityId, batchId])
  const allEdges = graphEdges || edges
  const {
    visibleEdges,
    visibleNodeCount,
    hiddenNodeCount,
    moreEligibleNodeCount,
    hasFurtherGenerations,
    rows,
    hasCycle,
  } = useMemo(() => {
    const neighbors = new Map()
    for (const edge of allEdges) {
      for (const [from, to] of [[edge.parentId, edge.childId], [edge.childId, edge.parentId]]) {
        const adjacent = neighbors.get(from) || []
        adjacent.push(to)
        neighbors.set(from, adjacent)
      }
    }

    const distance = new Map([[entityId, 0]])
    const pending = [entityId]
    while (pending.length) {
      const id = pending.shift()
      for (const neighbor of neighbors.get(id) || []) {
        if (distance.has(neighbor)) continue
        distance.set(neighbor, distance.get(id) + 1)
        pending.push(neighbor)
      }
    }

    const batchIds = new Map([[entityId, batchId]])
    for (const edge of allEdges) {
      batchIds.set(edge.parentId, edge.parentBatchId)
      batchIds.set(edge.childId, edge.childBatchId)
    }
    const eligibleNodes = [...distance.entries()]
      .filter(([, generation]) => generation <= visibleGenerations)
      .sort(([leftId, leftDepth], [rightId, rightDepth]) => (
        leftDepth - rightDepth
        || String(batchIds.get(leftId) || '').localeCompare(String(batchIds.get(rightId) || ''))
      ))
    const included = new Set(
      eligibleNodes.slice(0, visibleNodeLimit).map(([id]) => id)
    )
    const shownEdges = allEdges.filter((edge) => included.has(edge.parentId) && included.has(edge.childId))
    const graph = makeRows(shownEdges, entityId, batchId)
    return {
      visibleEdges: shownEdges,
      visibleNodeCount: included.size,
      hiddenNodeCount: Math.max(0, distance.size - included.size),
      moreEligibleNodeCount: Math.max(0, eligibleNodes.length - included.size),
      hasFurtherGenerations: distance.size > eligibleNodes.length,
      rows: graph.rows,
      hasCycle: graph.hasCycle,
    }
  }, [allEdges, batchId, entityId, visibleGenerations, visibleNodeLimit])
  const widestGeneration = Math.max(1, ...rows.map((row) => row.length))
  const genealogyBoardMinWidth = widestGeneration * 172 + 24

  const updateConnectors = () => {
    const board = boardRef.current
    if (!board) return
    const bounds = board.getBoundingClientRect()
    const paths = visibleEdges.flatMap((edge) => {
      const parent = nodeRefs.current.get(edge.parentId)?.getBoundingClientRect()
      const child = nodeRefs.current.get(edge.childId)?.getBoundingClientRect()
      if (!parent || !child) return []
      const startX = (parent.left + parent.width / 2 - bounds.left) / zoom
      const startY = (parent.bottom - bounds.top) / zoom
      const endX = (child.left + child.width / 2 - bounds.left) / zoom
      const endY = (child.top - bounds.top) / zoom
      const middleY = startY + (endY - startY) / 2
      return [{
        id: edge.id || `${edge.parentId}-${edge.childId}`,
        path: `M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}`,
        label: formatAllocation(edge),
      }]
    })
    setConnectors({ width: bounds.width / zoom, height: bounds.height / zoom, paths })
  }

  const updateMiniConnectors = () => {
    const board = miniBoardRef.current
    if (!board) return
    const bounds = board.getBoundingClientRect()
    const paths = miniEdges.flatMap((edge) => {
      const parent = miniNodeRefs.current.get(edge.parentId)?.getBoundingClientRect()
      const child = miniNodeRefs.current.get(edge.childId)?.getBoundingClientRect()
      if (!parent || !child) return []
      const startX = parent.left + parent.width / 2 - bounds.left
      const startY = parent.bottom - bounds.top
      const endX = child.left + child.width / 2 - bounds.left
      const endY = child.top - bounds.top
      const middleY = startY + (endY - startY) / 2
      return [`M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}`]
    })
    setMiniConnectors({ width: bounds.width, height: bounds.height, paths })
  }

  useLayoutEffect(() => {
    updateMiniConnectors()
    const board = miniBoardRef.current
    if (!board) return undefined
    const observer = new ResizeObserver(updateMiniConnectors)
    observer.observe(board)
    return () => observer.disconnect()
  }, [miniEdges, miniRows])

  useLayoutEffect(() => {
    if (!open) return undefined
    const board = boardRef.current
    if (!board) return undefined
    const measureBoard = () => {
      updateConnectors()
      const nextSize = { width: board.offsetWidth, height: board.offsetHeight }
      setCanvasSize((current) => (
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      ))
    }
    measureBoard()
    if (centerOnOpenRef.current && canvasSize.width && canvasSize.height) {
      const viewport = viewportRef.current
      const currentNode = nodeRefs.current.get(entityId)
      if (viewport && currentNode) {
        const viewportBounds = viewport.getBoundingClientRect()
        const nodeBounds = currentNode.getBoundingClientRect()
        viewport.scrollLeft += nodeBounds.left + nodeBounds.width / 2
          - (viewportBounds.left + viewport.clientWidth / 2)
        viewport.scrollTop += nodeBounds.top + nodeBounds.height / 2
          - (viewportBounds.top + viewport.clientHeight / 2)
        centerOnOpenRef.current = false
      }
    }
    const observer = new ResizeObserver(measureBoard)
    observer.observe(board)
    return () => observer.disconnect()
  }, [open, visibleEdges, rows, zoom, canvasSize, entityId])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const openGenealogy = async () => {
    centerOnOpenRef.current = true
    setOpen(true)
    setVisibleGenerations(1)
    setVisibleNodeLimit(25)
    setZoom(1)
    setLoadError('')
    if (graphEdges || !onLoadFullGenealogy) return

    setLoading(true)
    try {
      const result = await onLoadFullGenealogy(entityId)
      if (result?.error) {
        setLoadError(result.error.message || 'Unable to load the full genealogy.')
      } else if (result?.data) {
        setGraphEdges(result.data)
      }
    } catch (error) {
      setLoadError(error.message || 'Unable to load the full genealogy.')
    } finally {
      setLoading(false)
    }
  }

  const fitToView = () => {
    setZoom(1)
    requestAnimationFrame(() => {
      const viewport = viewportRef.current
      const board = boardRef.current
      if (!viewport || !board) return
      const scale = Math.min(
        1,
        Math.max(1, viewport.clientWidth - 56) / board.offsetWidth,
        Math.max(1, viewport.clientHeight - 56) / board.offsetHeight,
      )
      setZoom(Math.max(0.35, scale))
      requestAnimationFrame(() => {
        viewport.scrollLeft = 0
        viewport.scrollTop = 0
      })
    })
  }

  return (
    <>
      <div className="genealogy-overview">
        <p className="detail-muted">
          {miniEdges.length
            ? `${new Set(miniEdges.flatMap((edge) => [edge.parentId, edge.childId])).size} connected lots · Click the chart to expand`
            : 'No material links.'}
        </p>
        {miniEdges.length ? (
          <div
            className="genealogy-mini-preview is-clickable"
            role="button"
            tabIndex={0}
            aria-label={`Expand genealogy for ${batchId}`}
            onClick={openGenealogy}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                openGenealogy()
              }
            }}
          >
            <div className="genealogy-mini-board" ref={miniBoardRef}>
            <svg
              className="genealogy-flow-connectors"
              width={miniConnectors.width}
              height={miniConnectors.height}
              aria-hidden="true"
            >
              <defs>
                <marker id="genealogy-mini-arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                  <path d="M 0 0 L 6 3 L 0 6 z" />
                </marker>
              </defs>
              {miniConnectors.paths.map((path) => (
                <path key={path} d={path} markerEnd="url(#genealogy-mini-arrowhead)" />
              ))}
            </svg>
            {miniRows.map((row, rowIndex) => (
              <div className="genealogy-mini-row" key={rowIndex}>
                {row.map((node) => (
                  <div
                    key={node.id}
                    ref={(element) => {
                      if (element) miniNodeRefs.current.set(node.id, element)
                      else miniNodeRefs.current.delete(node.id)
                    }}
                    className={`genealogy-mini-node ${node.id === entityId ? 'current' : ''}`}
                  >
                    <strong>{node.batchId}</strong>
                    <small>{typeLabels[node.type] || 'Current lot'}</small>
                  </div>
                ))}
              </div>
            ))}
            {miniEdges.length > 1 && <span className="genealogy-mini-expand"><Maximize size={13} /> Expand</span>}
            </div>
          </div>
        ) : (
          <p className="genealogy-mini-empty">No linked lots yet</p>
        )}
      </div>
      {open && createPortal((
        <div className="modal-backdrop genealogy-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="genealogy-modal" role="dialog" aria-modal="true" aria-labelledby="genealogy-modal-heading">
            <header className="genealogy-modal-header">
              <div>
                <h2 id="genealogy-modal-heading">Genealogy</h2>
                <p>Current lot: <strong>{batchId}</strong></p>
              </div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close genealogy">
                <X size={20} />
              </button>
            </header>
            <div className="genealogy-toolbar">
              <span>{loading ? 'Loading full lineage…' : `${visibleNodeCount} lots shown${hiddenNodeCount ? ` · ${hiddenNodeCount} more hidden` : ''}`}</span>
              <div className="genealogy-toolbar-actions">
                {moreEligibleNodeCount > 0 && (
                  <button type="button" className="secondary-button" onClick={() => setVisibleNodeLimit((current) => current + 25)}>
                    Show 25 more lots
                  </button>
                )}
                {hasFurtherGenerations && (
                  <>
                    <button type="button" className="secondary-button" onClick={() => setVisibleGenerations((current) => current + 1)}>
                      Expand one generation
                    </button>
                    <button type="button" className="secondary-button" onClick={() => {
                      setVisibleGenerations(Number.POSITIVE_INFINITY)
                      setVisibleNodeLimit(Number.POSITIVE_INFINITY)
                    }}>
                      Show all
                    </button>
                  </>
                )}
                {hiddenNodeCount > 0 && !hasFurtherGenerations && moreEligibleNodeCount === 0 && (
                  <button type="button" className="secondary-button" onClick={() => {
                    setVisibleGenerations(Number.POSITIVE_INFINITY)
                    setVisibleNodeLimit(Number.POSITIVE_INFINITY)
                  }}>
                    Show all
                  </button>
                )}
                <button type="button" className="secondary-button" onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))} aria-label="Zoom out">
                  <Minus size={14} />
                </button>
                <span className="genealogy-zoom-value">{Math.round(zoom * 100)}%</span>
                <button type="button" className="secondary-button" onClick={() => setZoom((current) => Math.min(1.5, current + 0.1))} aria-label="Zoom in">
                  <Plus size={14} />
                </button>
                <button type="button" className="secondary-button" onClick={fitToView}>Fit to view</button>
              </div>
            </div>
            {loadError && <p className="genealogy-load-error"><AlertCircle size={15} />{loadError}</p>}
            {hasCycle ? (
              <p className="detail-muted genealogy-message">Genealogy links contain a cycle and cannot be displayed.</p>
            ) : (
              <div className="genealogy-modal-viewport" ref={viewportRef}>
                <div
                  className="genealogy-canvas"
                  style={{
                    width: canvasSize.width * zoom,
                    height: canvasSize.height * zoom,
                  }}
                >
                <div
                  className="genealogy-flow-board genealogy-modal-board"
                  ref={boardRef}
                  style={{
                    minWidth: `${genealogyBoardMinWidth}px`,
                    transform: `scale(${zoom})`,
                  }}
                >
                  <svg
                    className="genealogy-flow-connectors"
                    width={connectors.width}
                    height={connectors.height}
                    aria-hidden="true"
                  >
                    <defs>
                      <marker id="genealogy-modal-arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                        <path d="M 0 0 L 6 3 L 0 6 z" />
                      </marker>
                    </defs>
                    {connectors.paths.map((connector) => (
                      <path
                        key={connector.id}
                        d={connector.path}
                        markerEnd="url(#genealogy-modal-arrowhead)"
                        pointerEvents="stroke"
                      >
                        <title>{connector.label || 'Material link'}</title>
                      </path>
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
                          onClick={() => {
                            if (node.id === entityId) return
                            setOpen(false)
                            onNavigateEntity(node.id)
                          }}
                        >
                          <strong>{node.batchId}</strong>
                          <small>{typeLabels[node.type] || node.type || 'Current lot'}</small>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ), document.body)}
    </>
  )
}
