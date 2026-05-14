import { useEffect, useState } from "react";
import { getProducts } from "../api/api";
import ProductTable from "../components/ProductTable";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const data = await getProducts();
      setProducts(data);
    };

    load();
  }, []);

  // ✔ Search by SKU + Title + Category
  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();

    return (
      p.sku.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  // 📊 Statistics
  const total = products.length;
  const processed = products.filter(p => p.status === "processed").length;
  const failed = products.filter(p => p.status === "failed").length;
  const processing =
    products.filter(
      p => p.status !== "processed" && p.status !== "failed"
    ).length;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Products</h2>

      {/* 📊 Stats Panel */}
      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "15px",
          padding: "10px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          backgroundColor: "#f9f9f9"
        }}
      >
        <div><b>Total:</b> {total}</div>
        <div style={{ color: "green" }}><b>Processed:</b> {processed}</div>
        <div style={{ color: "red" }}><b>Failed:</b> {failed}</div>
        <div style={{ color: "orange" }}><b>Processing:</b> {processing}</div>
      </div>

      {/* 🔎 Search */}
      <input
        type="text"
        placeholder="Search SKU / Title / Category..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "8px",
          marginBottom: "15px",
          width: "300px",
          border: "1px solid #ccc",
          borderRadius: "6px"
        }}
      />

      {/* 📦 Table */}
      <ProductTable products={filteredProducts} />
    </div>
  );
}