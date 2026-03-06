import { env } from '../config/env.js';

export function computeMealAmountMad({ lunchSelected, dinnerSelected }) {
  if (lunchSelected && dinnerSelected) return env.BOTH_MEALS_AMOUNT_MAD;
  if (lunchSelected) return env.LUNCH_AMOUNT_MAD;
  if (dinnerSelected) return env.DINNER_AMOUNT_MAD;
  return 0;
}

export function computeDistanceAmountMad(distanceKm) {
  if (distanceKm > env.DISTANCE_REIMBURSEMENT_THRESHOLD_KM) {
    return env.DISTANCE_REIMBURSEMENT_AMOUNT_MAD;
  }
  return 0;
}

