// The minority group is encoded in the experiment tag of each classification run.
const minorityGroups: Array<{ match: string; label: string }> = [
  { match: "racial-black", label: "Pessoas negras" },
  { match: "indigenous", label: "Povos indígenas" },
  { match: "lgbt", label: "LGBTQIA+" },
  { match: "pcd", label: "Pessoas com deficiência" },
  { match: "women", label: "Mulheres" },
];

export const PILOT_GROUP = "Piloto (fora do recorte)";

export function minorityGroupOf(experimentsTags: string[]) {
  return minorityGroups.find((group) => experimentsTags.some((tag) => tag.includes(group.match)))?.label ?? PILOT_GROUP;
}
