import { useState } from "react";
import { importCSV } from "../api/api";

export default function ImportPage({ onDone }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [results, setResults] = useState(null);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file first");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setResults(null);

    try {
      const text = await file.text();

      // importCSV already returns parsed JSON
      const res = await importCSV(text);

      console.log("Import response:", res);

      setSuccess(true);
      setResults(res.results);

    } catch (err) {
      console.error("Upload error:", err);
      setError("CSV upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Import Products CSV</h2>

      {/* File selection */}
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <br /><br />

      {/* Upload button */}
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Import CSV"}
      </button>

      <br /><br />

      {/* Success message */}
      {success && (
        <div style={{ color: "green" }}>
          ✔ Import successful
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{ color: "red" }}>
          ❌ {error}
        </div>
      )}

      {/* Import results */}
      {results && (
        <div
          style={{
            marginTop: 20,
            padding: 10,
            border: "1px solid #ccc",
          }}
        >
          <h3>Import Summary</h3>

          <p>🆕 Inserted: {results.inserted}</p>
          <p>✏️ Updated: {results.updated}</p>
          <p>⏭️ Unchanged: {results.unchanged}</p>
          <p>⚙️ Queued: {results.queued}</p>
        </div>
      )}

      <br />

      {/* Navigate to products page */}
      {success && (
        <button onClick={onDone}>
          View Products
        </button>
      )}
    </div>
  );
}