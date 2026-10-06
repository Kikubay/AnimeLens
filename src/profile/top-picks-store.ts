import type { StorageAdapter } from '../storage/storage-adapter';
import type { TopPickPlan } from './top-picks';

export const TOP_PICKS_RANKING_KEY = 'manual_top_3_ranking';
export const TOP_PICKS_SIGNATURE_KEY = 'manual_top_3_pool_signature';

export interface TopPicksStore {
  /** An invalid or orphaned ranking is deleted on the way out. */
  load(plan: TopPickPlan): Promise<readonly number[] | null>;
  save(plan: TopPickPlan, ranking: readonly number[]): Promise<void>;
  clear(): Promise<void>;
}

export function createTopPicksStore(storage: StorageAdapter): TopPicksStore {
  return {
    async load(plan) {
      const [ranking, signature] = await Promise.all([
        storage.get(TOP_PICKS_RANKING_KEY),
        storage.get(TOP_PICKS_SIGNATURE_KEY),
      ]);
      const ids = isStoredRanking(ranking) ? ranking : null;
      if (ids === null || typeof signature !== 'string' || signature !== plan.signature) {
        // The tied pool moved on (new entry, re-score, deletion), so the leftovers are dropped and a stale ranking can never resurface.
        if (ranking !== undefined || signature !== undefined) await this.clear();
        return null;
      }
      if (plan.openSlots === 0 || !plan.needsChoice || ids.length !== plan.openSlots) {
        // The tie resolved itself, so the stored answer is meaningless now.
        await this.clear();
        return null;
      }
      return ids;
    },

    async save(plan, ranking) {
      await storage.set(TOP_PICKS_RANKING_KEY, [...ranking]);
      await storage.set(TOP_PICKS_SIGNATURE_KEY, plan.signature);
    },

    async clear() {
      await storage.remove(TOP_PICKS_RANKING_KEY);
      await storage.remove(TOP_PICKS_SIGNATURE_KEY);
    },
  };
}

function isStoredRanking(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)
  );
}
