const RESOURCE_ALIASES = {
  po: 'pods',
  pod: 'pods',
  deploy: 'deployment',
  deployments: 'deployment',
  svc: 'service',
  services: 'service',
  no: 'nodes',
  node: 'nodes',
  ep: 'endpoints',
  endpoint: 'endpoints',
  netpol: 'networkpolicy',
  networkpolicies: 'networkpolicy',
  sts: 'statefulset',
  statefulsets: 'statefulset',
}

function tokenize(raw) {
  return (raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

export function parseKubectl(raw) {
  const tokens = tokenize(raw)
  if (tokens.length === 0 || tokens[0] !== 'kubectl') return null

  let i = 1
  let namespace = 'production'
  const flags = {}

  // Global flags before verb.
  while (i < tokens.length) {
    const t = tokens[i]
    if (t === '-n' || t === '--namespace') {
      if (i + 1 < tokens.length) namespace = tokens[i + 1]
      i += 2
      continue
    }
    if (t.startsWith('--namespace=')) {
      namespace = t.split('=', 2)[1] || namespace
      i += 1
      continue
    }
    if (t.startsWith('-')) {
      const key = t.replace(/^-+/, '')
      const val = i + 1 < tokens.length && !tokens[i + 1].startsWith('-') ? tokens[i + 1] : true
      flags[key] = val
      i += val === true ? 1 : 2
      continue
    }
    break
  }

  if (i >= tokens.length) return null

  const verb = tokens[i]
  i += 1
  const args = []

  while (i < tokens.length) {
    const t = tokens[i]
    if (t === '-n' || t === '--namespace') {
      if (i + 1 < tokens.length) namespace = tokens[i + 1]
      i += 2
      continue
    }
    if (t.startsWith('--namespace=')) {
      namespace = t.split('=', 2)[1] || namespace
      i += 1
      continue
    }
    if (t.startsWith('-')) {
      const key = t.replace(/^-+/, '')
      const val = i + 1 < tokens.length && !tokens[i + 1].startsWith('-') ? tokens[i + 1] : true
      flags[key] = val
      i += val === true ? 1 : 2
      continue
    }
    args.push(t)
    i += 1
  }

  let resource = args[0] || ''
  let name = args[1] || null
  let subcommand = null

  if (verb === 'rollout' || verb === 'set') {
    subcommand = args[0] || null
    resource = args[1] || ''
    name = args[2] || null
  }

  if (verb === 'logs') {
    resource = 'pods'
    name = args[0] || null
  }

  if (verb === 'cordon' || verb === 'drain' || verb === 'uncordon') {
    resource = 'nodes'
    name = args[0] || null
  }

  resource = RESOURCE_ALIASES[resource] || resource

  return {
    raw: (raw || '').trim(),
    tokens,
    verb,
    resource,
    name,
    namespace,
    subcommand,
    flags,
    args,
  }
}

export function includesAllTokens(raw, required) {
  const lower = tokenize((raw || '').toLowerCase())
  return required.every((t) => lower.includes(String(t).toLowerCase()))
}

export function semanticMatchByReference(rawCommand, rawReference) {
  const current = parseKubectl(rawCommand)
  const reference = parseKubectl(rawReference)
  if (!current || !reference) return false

  if (current.verb !== reference.verb) return false
  if (reference.resource && current.resource !== reference.resource) return false
  if (reference.subcommand && current.subcommand !== reference.subcommand) return false

  if (reference.name && current.name !== reference.name) {
    return false
  }

  const refTokens = reference.tokens.slice(1).filter((t) => !t.startsWith('-'))
  const curTokens = new Set(current.tokens.slice(1).filter((t) => !t.startsWith('-')))

  return refTokens.every((t) => curTokens.has(t))
}
