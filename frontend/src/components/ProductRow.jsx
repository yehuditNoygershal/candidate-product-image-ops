import StatusActions from "./StatusActions";
import MetadataPanel from "./MetadataPanel";
import ImagesPanel from "./ImagesPanel";

export default function ProductRow({ product }) {
  return (
    <tr>
      <td>{product.sku}</td>
      <td>{product.title}</td>
      <td>{product.category}</td>

      <td>
        <StatusActions sku={product.sku} />
      </td>

      <td>
        <MetadataPanel sku={product.sku} />
      </td>

      <td>
        <ImagesPanel sku={product.sku} />
      </td>
    </tr>
  );
}