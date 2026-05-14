import { useState } from "react";
import { getProductBySku } from "../api/api";

export default function ImagesPanel({ sku }) {
  const [product, setProduct] = useState(null);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const data = await getProductBySku(sku);

    setProduct(data);

    if (data.status === "failed") {
      setMessage("Processing failed - no images available");
      return;
    }

    if (data.status !== "processed") {
      setMessage("Images will be displayed after processing is completed");
      return;
    }

    setMessage("");
    setShowModal(true);
  };

  return (
    <div>
      <button onClick={load}>
        View Images
      </button>

      {message && (
        <div style={{ marginTop: 5 }}>
          {message}
        </div>
      )}

      {showModal && product?.status === "processed" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: 20,
              borderRadius: 10,
              width: "700px",
              position: "relative",
            }}
          >

            <button
              onClick={() => setShowModal(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
              }}
            >
              X
            </button>

            <h2>Product Images</h2>

            {product.originalSignedUrl && (
              <div>
                <b>Original</b>
                <img
                  src={product.originalSignedUrl}
                  width="200"
                />
              </div>
            )}

            {product.thumbnailSignedUrl && (
              <div style={{ marginTop: 10 }}>
                <b>Thumbnail</b>
                <img
                  src={product.thumbnailSignedUrl}
                  width="120"
                />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}