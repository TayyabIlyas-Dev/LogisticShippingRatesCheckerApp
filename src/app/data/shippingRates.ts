export type ShippingRate = {
  original: number;
  discounted: number;
};

export let docsData: Record<string, ShippingRate> = {};
export let pkgData: Record<string, ShippingRate> = {};
export let discountData: Record<string, number> = {};

// ✅ Fetch from FastAPI and extract all unique countries & weights too
export async function fetchShippingRates(): Promise<{
  countries: string[];
  weights: number[];
}> {
  try {
    const res = await fetch('http://127.0.0.1:8000/all-rates');
    const json = await res.json();

    const records = json.data;

    // Clear previous data
    docsData = {};
    pkgData = {};
    discountData = {};

    const countrySet = new Set<string>();
    const weightSet = new Set<number>();

    for (const item of records) {
      const country = item.Country;
      const weight = item.Weight;
      const type = item.Type; // 'docs' | 'non-docs'
      const original = item["Retail Rate"];
      const discountedRaw = item["Discount Rate"];
      const key = `${country}_${weight}`;

      const discounted =
        discountedRaw === "No discount available"
          ? original
          : parseFloat(discountedRaw);

      const shippingRate: ShippingRate = {
        original,
        discounted,
      };

      if (type === "docs") {
        docsData[key] = shippingRate;
      } else if (type === "non-docs") {
        pkgData[key] = shippingRate;
      }

      if (discountedRaw !== "No discount available") {
        discountData[key] = original - discounted;
      }

      // Collect unique values
      countrySet.add(country);
      weightSet.add(weight);
    }

    console.log("✅ Shipping rates parsed and stored");

    // Return unique sorted lists
    return {
      countries: Array.from(countrySet).sort(),
      weights: Array.from(weightSet).sort((a, b) => a - b),
    };
  } catch (error) {
    console.error("❌ Failed to fetch or parse shipping rates:", error);
    return { countries: [], weights: [] };
  }
}
