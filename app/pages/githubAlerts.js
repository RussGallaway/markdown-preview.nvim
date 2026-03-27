const ALERT_TITLES = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution'
}

const ALERT_MARKER_RE = /^\s*\[!([A-Z]+)\][ \t]*/

function createAlertTitleTokens(state, level, title) {
  const open = new state.Token('paragraph_open', 'p', 1)
  open.block = true
  open.level = level
  open.attrJoin('class', 'markdown-alert-title')

  const inline = new state.Token('inline', '', 0)
  inline.block = true
  inline.level = level + 1
  inline.content = title

  const text = new state.Token('text', '', 0)
  text.content = title
  text.level = level + 1
  inline.children = [text]

  const close = new state.Token('paragraph_close', 'p', -1)
  close.block = true
  close.level = level

  return [open, inline, close]
}

function stripAlertMarker(inlineToken) {
  if (!inlineToken.children || inlineToken.children.length === 0) {
    inlineToken.content = inlineToken.content.replace(ALERT_MARKER_RE, '')
    return inlineToken.content.trim().length > 0
  }

  let markerRemoved = false
  const children = []

  inlineToken.children.forEach((child, index) => {
    if (!markerRemoved && child.type === 'text') {
      const replaced = child.content.replace(ALERT_MARKER_RE, '')
      if (replaced !== child.content) {
        markerRemoved = true
        child.content = replaced
      }
    }

    if (markerRemoved && children.length === 0 && index < inlineToken.children.length) {
      if (child.type === 'softbreak' && (!children.length || children.every(token => token.type === 'text' && token.content === ''))) {
        return
      }
    }

    if (child.type === 'text' && child.content === '') {
      return
    }

    children.push(child)
  })

  inlineToken.children = children
  inlineToken.content = children.map(child => (child.type === 'softbreak' ? '\n' : child.content || '')).join('')

  return inlineToken.content.trim().length > 0
}

export default function githubAlerts(md) {
  md.core.ruler.after('inline', 'github-alerts', state => {
    const tokens = state.tokens

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') {
        continue
      }

      let end = i + 1
      let level = 1
      while (end < tokens.length && level > 0) {
        if (tokens[end].type === 'blockquote_open') level++
        if (tokens[end].type === 'blockquote_close') level--
        end++
      }

      const paragraphOpenIndex = i + 1
      const inlineIndex = i + 2
      const paragraphCloseIndex = i + 3
      const paragraphOpen = tokens[paragraphOpenIndex]
      const inlineToken = tokens[inlineIndex]
      const paragraphClose = tokens[paragraphCloseIndex]

      if (
        !paragraphOpen ||
        paragraphOpen.type !== 'paragraph_open' ||
        !inlineToken ||
        inlineToken.type !== 'inline' ||
        !paragraphClose ||
        paragraphClose.type !== 'paragraph_close'
      ) {
        continue
      }

      const match = inlineToken.content.match(ALERT_MARKER_RE)
      if (!match) {
        continue
      }

      const alertType = match[1].toLowerCase()
      const title = ALERT_TITLES[alertType]
      if (!title) {
        continue
      }

      tokens[i].attrJoin('class', `markdown-alert markdown-alert-${alertType}`)
      const hasBodyInFirstParagraph = stripAlertMarker(inlineToken)
      const titleTokens = createAlertTitleTokens(state, paragraphOpen.level, title)

      if (hasBodyInFirstParagraph) {
        tokens.splice(i + 1, 0, ...titleTokens)
        end += titleTokens.length
      } else {
        tokens.splice(paragraphOpenIndex, 3, ...titleTokens)
        end += titleTokens.length - 3
      }

      i = end - 1
    }
  })
}
