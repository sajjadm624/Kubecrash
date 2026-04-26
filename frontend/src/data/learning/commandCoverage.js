import { parseKubectl } from '../../utils/kubectlParser'

export const COMMAND_COVERAGE_MATRIX = [
  {
    id: 'recon',
    label: 'Recon & Discovery',
    signatures: ['get:pods', 'get:service', 'get:endpoints', 'get:nodes', 'get:namespace', 'get:events'],
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    signatures: ['logs:pods', 'describe:pods', 'describe:service', 'describe:persistentvolumeclaim', 'top:pods'],
  },
  {
    id: 'workload-fixes',
    label: 'Workload Remediation',
    signatures: ['set:env:deployment', 'set:resources:deployment', 'rollout:status:deployment', 'rollout:history:deployment', 'rollout:undo:deployment'],
  },
  {
    id: 'network-fixes',
    label: 'Networking Remediation',
    signatures: ['patch:service', 'get:ingress', 'describe:ingress', 'describe:networkpolicy'],
  },
  {
    id: 'cluster-ops',
    label: 'Cluster Operations',
    signatures: ['create:serviceaccount', 'create:role', 'create:rolebinding', 'drain:nodes', 'cordon:nodes', 'uncordon:nodes'],
  },
]

const SIGNATURE_ALIASES = {
  'create:sa': 'create:serviceaccount',
  'create:svc': 'create:service',
  'get:svc': 'get:service',
  'describe:svc': 'describe:service',
  'get:ep': 'get:endpoints',
  'get:ns': 'get:namespace',
  'get:pvc': 'get:persistentvolumeclaim',
  'describe:pvc': 'describe:persistentvolumeclaim',
  'get:pv': 'get:persistentvolume',
}

function normalizeResource(resource) {
  if (!resource) return ''
  return String(resource).split('/')[0]
}

function normalizeSignature(signature) {
  return SIGNATURE_ALIASES[signature] || signature
}

export function buildCommandSignature(rawCommand) {
  const parsed = parseKubectl(rawCommand)
  if (!parsed) return null

  let signature = parsed.verb
  if (parsed.subcommand) signature += `:${parsed.subcommand}`

  const normalizedResource = normalizeResource(parsed.resource)
  if (normalizedResource) signature += `:${normalizedResource}`

  return normalizeSignature(signature)
}

export function commandCoverageStats(commandMastery) {
  const flat = new Set(COMMAND_COVERAGE_MATRIX.flatMap((group) => group.signatures))
  const mastered = new Set()

  for (const signature of Object.keys(commandMastery || {})) {
    const item = commandMastery[signature]
    if (!item || typeof item !== 'object') continue
    if (!flat.has(signature)) continue
    if ((item.successes || 0) > 0) mastered.add(signature)
  }

  const total = flat.size || 1
  const done = mastered.size
  const percentage = Math.round((done / total) * 100)

  const byGroup = COMMAND_COVERAGE_MATRIX.map((group) => {
    const groupDone = group.signatures.filter((sig) => mastered.has(sig)).length
    const groupTotal = group.signatures.length || 1
    return {
      ...group,
      completed: groupDone,
      total: group.signatures.length,
      percentage: Math.round((groupDone / groupTotal) * 100),
    }
  })

  return {
    total,
    done,
    percentage,
    byGroup,
  }
}

export function isKnownCoverageCommand(signature) {
  const all = COMMAND_COVERAGE_MATRIX.flatMap((group) => group.signatures)
  return all.includes(signature)
}
