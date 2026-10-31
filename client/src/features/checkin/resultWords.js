import { PSS_BANDS, WHO_BANDS } from "@/utils/checkinResult";

// A score in a few plain words, for the Wellbeing cards and the result heading. Same cut-offs as the
// longer sentences in checkinResult.js. These describe how a period felt; they are not a diagnosis.
export function resultWords(kind, score) {
  if (kind === "pss") {
    if (score <= PSS_BANDS.calmMax) return "Low stress";
    return score < PSS_BANDS.highMin ? "Moderate stress" : "High stress";
  }
  if (score >= WHO_BANDS.okayMin) return "Doing okay";
  return score > WHO_BANDS.lowMax ? "Feeling a bit low" : "A hard stretch";
}
