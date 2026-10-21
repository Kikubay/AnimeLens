const RECOMMENDATION_YEAR_MIN = 1950;
export const RECOMMENDATION_YEAR_DEFAULT_START = 2010;

export interface RecommendationPeriod {
  readonly startYear: number;
  readonly endYear: number;
}

export function currentCalendarYear(): number {
  return new Date().getFullYear();
}

export function recommendationYearOptions(
  currentYear: number = currentCalendarYear(),
): readonly number[] {
  const years: number[] = [];
  for (let year = currentYear; year >= RECOMMENDATION_YEAR_MIN; year -= 1) years.push(year);
  return years;
}

function clampYear(value: unknown, fallback: number, currentYear: number): number {
  const year = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(currentYear, Math.max(RECOMMENDATION_YEAR_MIN, year));
}

export function normalizeRecommendationPeriod(
  startYear: unknown,
  endYear: unknown,
  currentYear: number = currentCalendarYear(),
): RecommendationPeriod {
  const start = clampYear(startYear, RECOMMENDATION_YEAR_DEFAULT_START, currentYear);
  const end = clampYear(endYear, currentYear, currentYear);
  return end < start ? { startYear: start, endYear: start } : { startYear: start, endYear: end };
}

export function recommendationPeriodWithStartYear(
  period: RecommendationPeriod,
  startYear: number,
  currentYear: number = currentCalendarYear(),
): RecommendationPeriod {
  const start = clampYear(startYear, period.startYear, currentYear);
  return { startYear: start, endYear: Math.min(currentYear, Math.max(period.endYear, start)) };
}

export function recommendationPeriodWithEndYear(
  period: RecommendationPeriod,
  endYear: number,
  currentYear: number = currentCalendarYear(),
): RecommendationPeriod {
  const end = clampYear(endYear, period.endYear, currentYear);
  return {
    startYear: Math.max(RECOMMENDATION_YEAR_MIN, Math.min(period.startYear, end)),
    endYear: end,
  };
}
