import { useState } from "react";
import { getProductBySku, getJobBySku, retryProduct } from "../api/api";

export default function StatusActions({ sku }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");

  const checkStatus = async () => {
    const data = await getProductBySku(sku);
    setProduct(data);
  };

  const showErrors = async () => {
    const data = await getJobBySku(sku);
    setError(data.error);
  };

  const retry = async () => {
    await retryProduct(sku);
    alert("Retry sent");
  };

  const status = product?.status;

  return (
    <div>
      <button onClick={checkStatus}>
        Check Status
      </button>

      {/* ✔ Always displayed after click */}
      {product && (
        <div style={{ marginTop: 8 }}>
          <b>Status:</b>{" "}
          <span
            style={{
              color:
                status === "processed"
                  ? "green"
                  : status === "failed"
                  ? "red"
                  : "orange",
            }}
          >
            {status}
          </span>
        </div>
      )}

      {/* ✔ Only if failed */}
      {status === "failed" && (
        <div style={{ marginTop: 8 }}>
          <button onClick={showErrors}>
            Show errors
          </button>

          <button onClick={retry}>
            Retry
          </button>

          {error && (
            <div style={{ color: "red", marginTop: 5 }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



