export type ShippingRate = {
  original: number;
  discounted: number;
  student?: boolean; // NEW
  zone?: string | null; // NEW
};

export const docsData: Record<string, ShippingRate> = {};
export const pkgData: Record<string, ShippingRate> = {};
export const discountData: Record<string, number> = {};

// fetchShippingRates.ts
export async function fetchShippingRates(): Promise<{
  countries: string[];
  weights: number[];
  docsData: Record<string, ShippingRate>;
  pkgData: Record<string, ShippingRate>;
}> {
  try {
    const res = await fetch('https://c8ebe687-3159-412a-b8ef-96340f3a69dc-00-1gvs8vvnrpohg.sisko.replit.dev/all-rates');
    const json = await res.json();

    const records = json.data;
    const docs: Record<string, ShippingRate> = {};
    const pkg: Record<string, ShippingRate> = {};
    const countrySet = new Set<string>();
    const weightSet = new Set<number>();

    for (const item of records) {
      const key = `${item.Country}_${item.Weight}`;
      const discounted =
        item["Discount Rate"] === "No discount available"
          ? item["Retail Rate"]
          : parseFloat(item["Discount Rate"]);

      const rate: ShippingRate = {
        original: item["Retail Rate"],
        discounted,
        student: item.Student ?? false,
        zone: item.Zone ?? null,
      };

      if (item.Type === "docs") docs[key] = rate;
      else if (item.Type === "non-docs") pkg[key] = rate;

      countrySet.add(item.Country);
      weightSet.add(item.Weight);
    }

    return {
      countries: Array.from(countrySet).sort(),
      weights: Array.from(weightSet).sort((a, b) => a - b),
      docsData: docs,
      pkgData: pkg,
    };
  } catch (err) {
    console.error("❌ Failed to fetch or parse shipping rates:", err);
    return { countries: [], weights: [], docsData: {}, pkgData: {} };
  }
}
