export type ShippingRate = {
  original: number;
  discounted: number;
  student?: boolean; 
  zone?: string | null; 
  addkg?: number | null; 
  type?: string;
  surcharges?: number; // ✅ added to include surcharge info
};

export const docsData: Record<string, ShippingRate> = {};
export const pkgData: Record<string, ShippingRate> = {};
export const discountData: Record<string, number> = {};
export const surchargesData: Record<string, number> = {}; // ✅ NEW

export async function fetchShippingRates(
  province: 'sindh' | 'punjab' | 'balochistan' = 'sindh'
): Promise<{
  countries: string[];
  weights: number[];
  docsData: Record<string, ShippingRate>;
  pkgData: Record<string, ShippingRate>;
  addkgData: Record<string, ShippingRate>;
  surchargesData: Record<string, number>; // ✅ NEW
}> {
  try {
    // const res = await fetch('https://06d75d5e-523a-4ae0-9015-f96e9ebb379b-00-2htr8edtkrdqn.pike.replit.dev:8000/all-rates');
    // const res = await fetch('http://127.0.0.1:8000/all-rates');
const res = await fetch(`https://79e488e3-3feb-47f6-afc9-99f176e763b7-00-t6un1m7gnee5.pike.replit.dev/${province}-rates`);


    const json = await res.json();
    const records = json.data;

    const docs: Record<string, ShippingRate> = {};
    const pkg: Record<string, ShippingRate> = {};
    const addkg: Record<string, ShippingRate> = {};
    const surcharges: Record<string, number> = {}; // ✅ NEW

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
        addkg: item.Addkg ?? null,
        type: item.Type,
      };

      if (item.Type === "docs") docs[key] = rate;
      else if (item.Type === "non-docs") pkg[key] = rate;
      else if (item.Type === "add-kg") addkg[key] = rate;
      else if (item.Type === "sur-charges") {
        const normalizedCountry = item.Country?.toLowerCase().trim();
        if (normalizedCountry && item.Surcharges > 0) {
          surcharges[normalizedCountry] = item.Surcharges;
        }
      }

      countrySet.add(item.Country);
      weightSet.add(item.Weight);
    }

    return {
      countries: Array.from(countrySet).sort(),
      weights: Array.from(weightSet).sort((a, b) => a - b),
      docsData: docs,
      pkgData: pkg,
      addkgData: addkg,
      surchargesData: surcharges, // ✅ return
    };
  } catch (err) {
    console.error("❌ Failed to fetch or parse shipping rates:", err);
    return { countries: [], weights: [], docsData: {}, pkgData: {}, addkgData: {}, surchargesData: {} };
  }
}
