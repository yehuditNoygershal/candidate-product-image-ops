import ProductRow from "./ProductRow";

export default function ProductTable({ products }) {
  return (
    <table border="1" cellPadding="8" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Title</th>
          <th>Category</th>
          <th>Status</th>
          <th>Metadata</th>
          <th>Images</th>
        </tr>
      </thead>

      <tbody>
        {products.map((p) => (
          <ProductRow key={p.sku} product={p} />
        ))}
      </tbody>
    </table>
  );
}