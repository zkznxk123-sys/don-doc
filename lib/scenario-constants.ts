export const SCENARIO_CATEGORIES = ['부동산', '투자', '부채', '현금흐름', '연금/장기'] as const
export type ScenarioCategory = typeof SCENARIO_CATEGORIES[number]
