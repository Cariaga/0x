'use strict'
const fg = require('d3-fg')
const render = require('nanohtml')
const morphdom = require('morphdom')
const debounce = require('debounce')
const createActions = require('./actions')
const createState = require('./state')
const graph = require('./cmp/graph')(render)
const ui = require('./cmp/ui')(render)

module.exports = function (trees, opts) {
  opts = opts || {}
  const { kernelTracing } = opts
  const exclude = new Set(['cpp', 'regexp', 'v8', 'native', 'init'])

  const chart = graph()
  const tree = trees.unmerged // default view
  const categorizer = !kernelTracing && graph.v8cats
  const flamegraph = fg({
    categorizer, 
    tree, 
    exclude: Array.from(exclude), 
    element: chart
  })
  const { colors } = flamegraph

  let userZoom = true // false if the last zoom call was initiated by 0x
  flamegraph.on('zoom', (d) => {
    if (!userZoom) {
      userZoom = true
      return
    }

    pushState(d)
  })
  window.addEventListener('popstate', (event) => {
    userZoom = false
    jumpToState(event.state || {
      // No hash anymore, jump to root node (0) but don't change settings
      merged: state.control.merged,
      exclude: Array.from(state.filterTypes.exclude),
      nodeId: 0,
    })
  })

  window.addEventListener('resize', debounce(() => {
    const width = document.body.clientWidth * 0.89
    flamegraph.width(width).update()
    chart.querySelector('svg').setAttribute('width', width)
  }, 150))

  const state = createState({colors, trees, exclude, kernelTracing, title: opts.title})

  const actions = createActions({flamegraph, state}, (state) => {
    morphdom(iface, ui({state, actions}))
  })
  const iface = ui({state, actions})
  const jumpToState = actions.jumpToState()
  const pushState = actions.pushState()

  document.body.appendChild(chart)
  document.body.appendChild(iface)

  if (window.location.hash) {
    const st = parseHistoryState(window.location.hash)
    if (st) {
      userZoom = false
      jumpToState(st)
    }
  }
}

function parseHistoryState (str) {
  const parts = str.replace(/^#/, '').split('-')
  const merged = parts[0] === 'merged'
  const nodeId = parseInt(parts[1], 10)
  const excludeTypes = parts[2].split('+')
  return { merged, nodeId, excludeTypes }
}
