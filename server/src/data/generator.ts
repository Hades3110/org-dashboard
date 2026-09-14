import type { OrgNodeDto } from '../types.js'

// mulberry32 — tiny deterministic PRNG. A fixed seed keeps every run of the
// generator byte-for-byte identical, which is what makes the dataset reproducible.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEED = 1337
const BASE_TIMESTAMP = Date.UTC(2026, 0, 1, 9, 0, 0)

const DIVISION_NAMES = ['Технологии', 'Продажи и маркетинг', 'Операции', 'Финансы и администрирование']

const DEPARTMENT_NAME_POOL = [
  'Разработка',
  'Дизайн',
  'Аналитика',
  'Поддержка клиентов',
  'Логистика',
  'Бухгалтерия',
  'HR',
  'Юридический отдел',
  'Закупки',
  'Контроль качества',
]

type Range = readonly [min: number, max: number]

const RANGES = {
  company: { headcount: [50, 150], budget: [5_000_000, 20_000_000], performance: [55, 95] },
  division: { headcount: [20, 80], budget: [2_000_000, 8_000_000], performance: [45, 95] },
  department: { headcount: [5, 30], budget: [300_000, 2_000_000], performance: [35, 100] },
  team: { headcount: [2, 12], budget: [50_000, 500_000], performance: [20, 100] },
} satisfies Record<string, { headcount: Range; budget: Range; performance: Range }>

function randInt(rng: () => number, [min, max]: Range): number {
  return Math.round(min + rng() * (max - min))
}

function randUpdatedAt(rng: () => number): string {
  const daysAgo = randInt(rng, [0, 45])
  const hoursAgo = randInt(rng, [0, 23])
  return new Date(BASE_TIMESTAMP - daysAgo * 86_400_000 - hoursAgo * 3_600_000).toISOString()
}

export function generateOrgTree(): OrgNodeDto[] {
  const rng = mulberry32(SEED)
  const nodes: OrgNodeDto[] = []

  const company: OrgNodeDto = {
    id: 'company',
    name: 'Атлас Групп',
    parentId: null,
    headcount: randInt(rng, RANGES.company.headcount),
    budget: randInt(rng, RANGES.company.budget),
    performance: randInt(rng, RANGES.company.performance),
    updatedAt: randUpdatedAt(rng),
  }
  nodes.push(company)

  DIVISION_NAMES.forEach((divisionName, divisionIndex) => {
    const divisionId = `division-${divisionIndex + 1}`
    nodes.push({
      id: divisionId,
      name: divisionName,
      parentId: company.id,
      headcount: randInt(rng, RANGES.division.headcount),
      budget: randInt(rng, RANGES.division.budget),
      performance: randInt(rng, RANGES.division.performance),
      updatedAt: randUpdatedAt(rng),
    })

    const departmentCount = randInt(rng, [2, 4])
    const shuffledDepartmentNames = [...DEPARTMENT_NAME_POOL].sort(() => rng() - 0.5)

    for (let departmentIndex = 0; departmentIndex < departmentCount; departmentIndex++) {
      const departmentId = `${divisionId}-department-${departmentIndex + 1}`
      const departmentName = shuffledDepartmentNames[departmentIndex % shuffledDepartmentNames.length]
      if (departmentName === undefined) continue
      nodes.push({
        id: departmentId,
        name: `${departmentName} (${divisionName})`,
        parentId: divisionId,
        headcount: randInt(rng, RANGES.department.headcount),
        budget: randInt(rng, RANGES.department.budget),
        performance: randInt(rng, RANGES.department.performance),
        updatedAt: randUpdatedAt(rng),
      })

      const teamCount = randInt(rng, [2, 5])
      for (let teamIndex = 0; teamIndex < teamCount; teamIndex++) {
        nodes.push({
          id: `${departmentId}-team-${teamIndex + 1}`,
          name: `${departmentName}: группа ${teamIndex + 1}`,
          parentId: departmentId,
          headcount: randInt(rng, RANGES.team.headcount),
          budget: randInt(rng, RANGES.team.budget),
          performance: randInt(rng, RANGES.team.performance),
          updatedAt: randUpdatedAt(rng),
        })
      }
    }
  })

  return nodes
}

// Computed once per process start, not per request — the dataset is static
// until step/3 wires up live patches over the same array.
export const ORG_TREE: OrgNodeDto[] = generateOrgTree()
