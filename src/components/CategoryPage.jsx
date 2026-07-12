import { useState, useEffect, useRef } from "react";

const API_BASE_URL = "https://api.vapezone.com.mx";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCategoryIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("category");
  return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : null;
}

function calcPrice(p) {
  const hasDiscount =
    p.sale_price && parseFloat(p.sale_price) < parseFloat(p.price);
  return { hasDiscount, display: hasDiscount ? p.sale_price : p.price };
}

// ─── Skeletons ────────────────────────────────────────────────────────────────
function CategorySkeleton() {
  return (
    <div>
      <div className="skeleton-hero" />
      <div className="container" style={{ marginTop: "2rem" }}>
        <div className="shop-layout">
          <div className="skeleton-sidebar">
            <div className="skeleton-block" />
            <div className="skeleton-block" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="products-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="product-card-skeleton" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, delay = 0 }) {
  const { hasDiscount, display } = calcPrice(product);
  return (
    <a
      href={`/product/${product.id}`}
      className="product-card reveal-item is-visible"
      style={{ transitionDelay: `${delay}ms` }}
      data-price={display}
    >
      <div className="product-image-wrapper">
        {hasDiscount && <span className="product-badge">Oferta</span>}
        <img src={product.image_url} alt={product.name} loading="lazy" />
      </div>
      <div className="product-info">
        <p className="product-brand">{product.brand || ""}</p>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price-row">
          <span className="product-price">${display}</span>
          {hasDiscount && (
            <span className="product-original-price">${product.price}</span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Search dropdown ──────────────────────────────────────────────────────────
function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const ref = useRef(null);

  async function loadProducts() {
    if (allProducts.length > 0 || fetching) return;
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products?limit=1000`);
      const json = await res.json();
      if (json.success) setAllProducts(json.data.filter((p) => p.is_active));
    } catch {}
    setFetching(false);
  }

  function handleInput(e) {
    const term = e.target.value;
    setQuery(term);
    if (!term.trim()) { setOpen(false); return; }
    const matches = allProducts
      .filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(term.toLowerCase())) ||
          (p.brand && p.brand.toLowerCase().includes(term.toLowerCase()))
      )
      .slice(0, 6);
    setResults(matches);
    setOpen(true);
  }

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="search-wrapper" style={{ position: "relative" }} ref={ref}>
      <input
        type="text"
        placeholder="Escribe para buscar..."
        autoComplete="off"
        value={query}
        onFocus={loadProducts}
        onChange={handleInput}
      />
      {open && (
        <div className="search-dropdown" style={{ display: "block" }}>
          {results.length > 0 ? (
            results.map((p) => {
              const { display } = calcPrice(p);
              return (
                <a
                  key={p.id}
                  href={`/product/${p.id}`}
                  className="search-result-item"
                >
                  <img src={p.image_url} alt={p.name} />
                  <div className="search-result-info">
                    <span className="sr-brand">{p.brand || ""}</span>
                    <span className="sr-name">{p.name}</span>
                    <span className="sr-price">${display}</span>
                  </div>
                </a>
              );
            })
          ) : (
            <div className="sr-empty">No se encontraron productos</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CategoryPage() {
  const [category, setCategory] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const categoryId = getCategoryIdFromUrl();
    if (!categoryId) { window.location.href = "/"; return; }

    async function fetchData() {
      try {
        const [catRes, allCatRes] = await Promise.all([
          fetch(`${API_BASE_URL}/categories/${categoryId}`),
          fetch(`${API_BASE_URL}/categories?limit=1000`),
        ]);

        if (!catRes.ok) throw new Error("category not found");
        const catResult = await catRes.json();
        if (!catResult.success || !catResult.data) {
          window.location.href = "/";
          return;
        }

        const cat = catResult.data;
        document.title = `${cat.name} | Vapezone`;
        setCategory(cat);

        // All categories for sidebar
        if (allCatRes.ok) {
          const allCatResult = await allCatRes.json();
          if (allCatResult.success && allCatResult.data) {
            setAllCategories(
              allCatResult.data
                .filter((c) => c.is_active)
                .sort((a, b) => a.display_order - b.display_order)
            );
          }
        }

        // Products in this category
        const prodRes = await fetch(
          `${API_BASE_URL}/products?category_id=${cat.id}&limit=100`
        );
        if (!prodRes.ok) throw new Error("products fetch failed");
        const prodResult = await prodRes.json();

        if (prodResult.success && prodResult.data) {
          const prods = prodResult.data
            .filter(
              (p) =>
                p.is_active &&
                p.featured != 1 &&
                p.featured !== true &&
                p.featured !== "1"
            )
            .sort((a, b) => a.display_order - b.display_order);
          setProducts(prods);
          setFilteredProducts(prods);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // ── Price filter ───────────────────────────────────────────────────────────
  function applyFilter() {
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || Infinity;
    setFilteredProducts(
      products.filter((p) => {
        const { display } = calcPrice(p);
        const price = parseFloat(display);
        return price >= min && price <= max;
      })
    );
  }

  function resetFilter() {
    setMinPrice("");
    setMaxPrice("");
    setFilteredProducts(products);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <CategorySkeleton />;
  if (error) {
    return (
      <div className="full-error">
        <p>⚠️ No se pudo cargar esta categoría.</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }
  if (!category) return null;

  const currentCategoryId = getCategoryIdFromUrl();

  return (
    <>
      <main className="category-page">
        <header className="category-hero">
          <h1 className="category-title reveal-item is-visible">
            {category.name}
          </h1>
          <p
            className="category-subtitle reveal-item is-visible"
            style={{ transitionDelay: "0.1s" }}
          >
            Explora nuestra colección de {category.name.toLowerCase()}
          </p>
        </header>

        <div className="shop-layout container">
          {/* Sidebar */}
          <aside
            className="shop-sidebar reveal-item is-visible"
            style={{ transitionDelay: "0.2s" }}
          >
            <div className="filter-group">
              <h3 className="filter-title">Buscar Producto</h3>
              <SearchBox />
            </div>

            <div className="filter-group">
              <h3 className="filter-title">Categorías</h3>
              <ul className="category-list">
                {allCategories.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`/category/${c.id}`}
                      className={
                        String(c.id) === String(currentCategoryId) ? "active" : ""
                      }
                    >
                      {c.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="filter-group">
              <h3 className="filter-title">Filtrar por Precio</h3>
              <div className="price-inputs">
                <input
                  type="number"
                  placeholder="Min $"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max $"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
              <button className="filter-btn" onClick={applyFilter}>
                Aplicar Filtro
              </button>
              <button className="filter-btn reset-btn" onClick={resetFilter}>
                Restablecer
              </button>
            </div>
          </aside>

          {/* Products */}
          <div className="shop-content">
            {filteredProducts.length > 0 ? (
              <div className="products-grid" id="products-grid">
                {filteredProducts.map((p, i) => (
                  <ProductCard key={p.id} product={p} delay={i * 50} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>
                  No hay productos disponibles en esta categoría por el momento.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
