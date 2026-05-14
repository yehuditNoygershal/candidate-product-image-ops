import { useState } from "react";
import { getProductBySku } from "../api/api";

export default function MetadataPanel({ sku }) {
  const [product, setProduct] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const data = await getProductBySku(sku);
    setProduct(data);

    if (data.status === "failed") {
      setMessage("Processing failed, so no metadata is available");
      return;
    }

    if (data.status !== "processed") {
      setMessage("Metadata will be displayed after processing is completed");
      return;
    }

    setMessage("");
  };

  const metadata = product?.metadata;

  return (
    <div>
      <button onClick={load}>
        View Metadata
      </button>

      {message && (
        <div style={{ marginTop: 5 }}>
          {message}
        </div>
      )}

      {product?.status === "processed" && metadata && (
        <div style={{ marginTop: 10 }}>

          {product.message && (
            <div style={{ color: "blue", marginBottom: 10 }}>
              {product.message}
            </div>
          )}

          <div>Width: {metadata.width}</div>
          <div>Height: {metadata.height}</div>
          <div>Format: {metadata.format}</div>

          <div>
            Processing Time: {product.processingTimeMs} ms
          </div>

        </div>
      )}
    </div>
  );
}