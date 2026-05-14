const API_BASE = "https://0vq0us4gx9.execute-api.eu-central-1.amazonaws.com/prod";

/**
 * Import CSV 
 */
export async function importCSV(csvText) {
  const res = await fetch(`${API_BASE}/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ csv: csvText }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Import failed");
  }

  return data; 
}
/**
 * Fetch all products 
 */
export async function getProducts() {
  const res = await fetch(`${API_BASE}/products`);

  if (!res.ok) {
    throw new Error("Failed to fetch products");
  }

  return res.json();
}

/**
 * Fetch a single product by SKU (for details / status / metadata / images)
 */
export async function getProductBySku(sku) {
  const res = await fetch(`${API_BASE}/products/${sku}`);

  if (!res.ok) {
    throw new Error("Failed to fetch product");
  }

  return res.json();
}

/**
 * Fetch job 
 */
export async function getJobBySku(sku) {
  const res = await fetch(`${API_BASE}/jobs/${sku}`);

  if (!res.ok) {
    throw new Error("Failed to fetch job");
  }

  return res.json();
}

/**
 * Retry failed product
 */
export async function retryProduct(sku) {
  const res = await fetch(`${API_BASE}/retry/${sku}`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error("Retry failed");
  }

  return res.json();
}