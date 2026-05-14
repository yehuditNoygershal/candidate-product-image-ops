import { useState } from 'react'
import './App.css'

import ImportPage from './pages/ImportPage'
import ProductsPage from './pages/ProductsPage'

function App() {
  const [page, setPage] = useState("import")

  return (
    <>
      {page === "import" && (
        <ImportPage onDone={() => setPage("products")} />
      )}

      {page === "products" && (
        <ProductsPage
          onBack={() => setPage("import")}
        />
      )}
    </>
  )
}

export default App