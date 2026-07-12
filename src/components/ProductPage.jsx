import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE_URL = "https://api.vapezone.com.mx";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getProductIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("product");
  return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : null;
}

function getFullUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function calcPrice(product) {
  const hasDiscount =
    product.sale_price &&
    parseFloat(product.sale_price) < parseFloat(product.price);
  return {
    hasDiscount,
    display: hasDiscount ? product.sale_price : product.price,
    original: product.price,
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="product-page">
      <div className="product-container">
        <div className="skeleton-img" />
        <div className="skeleton-info">
          <div className="skeleton-line short" />
          <div className="skeleton-line long" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line short" />
          <div
            className="skeleton-line long"
            style={{ height: "3rem", marginTop: "1rem" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────
function ErrorView({ onRetry, home = false }) {
  return (
    <div className="full-error">
      <p>⚠️ No se pudo cargar este producto.</p>
      {home ? (
        <button onClick={() => (window.location.href = "/")}>
          Ir al inicio
        </button>
      ) : (
        <button onClick={onRetry}>Reintentar</button>
      )}
    </div>
  );
}

// ─── Related product card ─────────────────────────────────────────────────────
function RelatedCard({ product }) {
  const { hasDiscount, display } = calcPrice(product);
  return (
    <a href={`/product/${product.id}`} className="product-card">
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProductPage() {
  const [product, setProduct] = useState(null);
  const [allImages, setAllImages] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Gallery state
  const [imgIndex, setImgIndex] = useState(0);
  const autoSlideRef = useRef(null);

  // Variants
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [selectedVariantName, setSelectedVariantName] = useState(null);
  const [variantError, setVariantError] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const productId = getProductIdFromUrl();
    if (!productId) {
      window.location.href = "/";
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!res.ok) throw new Error("product not found");
        const json = await res.json();
        if (!json.success || !json.data) {
          window.location.href = "/";
          return;
        }

        const p = json.data;
        document.title = `${p.name} | Vapezone`;

        // Build images array
        const imgs = [];
        if (p.image_url) imgs.push(getFullUrl(p.image_url));
        if (Array.isArray(p.images))
          p.images.forEach((img) => { if (img) imgs.push(getFullUrl(img)); });
        setAllImages(imgs);

        // Parse details
        if (p.details) {
          try {
            p._details =
              typeof p.details === "string"
                ? JSON.parse(p.details)
                : p.details;
          } catch {}
        }

        // Parse categories → get categoryId
        let categoryId = null;
        const cats = p.categories;
        const parsedCats = typeof cats === "string" ? JSON.parse(cats) : cats;
        if (Array.isArray(parsedCats) && parsedCats.length > 0)
          categoryId = parsedCats[0]?.id ?? null;
        p._categoryId = categoryId;

        setProduct(p);

        // Fetch related products
        if (categoryId) {
          try {
            const relRes = await fetch(
              `${API_BASE_URL}/products?category_id=${categoryId}&limit=5`
            );
            if (relRes.ok) {
              const relJson = await relRes.json();
              if (relJson.success && relJson.data) {
                setRelated(
                  relJson.data
                    .filter((rp) => String(rp.id) !== String(productId))
                    .slice(0, 4)
                );
              }
            }
          } catch {}
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // ── Gallery auto-slide ─────────────────────────────────────────────────────
  const startAutoSlide = useCallback(() => {
    clearInterval(autoSlideRef.current);
    if (allImages.length <= 1) return;
    autoSlideRef.current = setInterval(() => {
      setImgIndex((i) => (i + 1) % allImages.length);
    }, 4000);
  }, [allImages]);

  useEffect(() => {
    startAutoSlide();
    return () => clearInterval(autoSlideRef.current);
  }, [startAutoSlide]);

  function goToImage(idx) {
    clearInterval(autoSlideRef.current);
    setImgIndex(idx);
    startAutoSlide();
  }

  // ── Add to cart ────────────────────────────────────────────────────────────
  function handleAddToCart() {
    const activeVariants = (product.variants || []).filter((v) => v.is_active);
    if (activeVariants.length > 0 && !selectedVariantId) {
      setVariantError(true);
      return;
    }

    const { display } = calcPrice(product);
    const data = {
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: display,
      image_url: product.image_url,
      stock: product.stock,
    };

    if (selectedVariantId) {
      data.variant_id = selectedVariantId;
      data.name = `${data.name} - ${selectedVariantName}`;
      const variantData = (product.variants || []).find(
        (v) => String(v.id) === String(selectedVariantId)
      );
      if (variantData) data.stock = variantData.stock;
    }

    if (window.addToCart) window.addToCart(data);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <ProductSkeleton />;
  if (error) return <ErrorView home />;
  if (!product) return null;

  const { hasDiscount } = calcPrice(product);
  const activeVariants = (product.variants || []).filter((v) => v.is_active);
  const details = product._details;

  return (
    <>
      {/* ── Product detail ── */}
      <main className="product-page" style={{ display: "block" }}>
        <div className="product-container">
          {/* Image column */}
          <div className="product-image-col reveal-item is-visible">
            <div
              className="image-wrapper"
              onMouseEnter={() => clearInterval(autoSlideRef.current)}
              onMouseLeave={startAutoSlide}
            >
              {hasDiscount && <span className="sale-badge">Oferta</span>}

              <img
                id="main-product-image"
                src={allImages[imgIndex] || product.image_url}
                alt={product.name}
                style={{ transition: "opacity 0.3s ease" }}
              />

              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery-nav prev"
                    aria-label="Anterior imagen"
                    onClick={() =>
                      goToImage(
                        (imgIndex - 1 + allImages.length) % allImages.length
                      )
                    }
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="gallery-nav next"
                    aria-label="Siguiente imagen"
                    onClick={() =>
                      goToImage((imgIndex + 1) % allImages.length)
                    }
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="product-gallery">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`gallery-thumbnail ${i === imgIndex ? "active" : ""}`}
                    aria-label={`Ver imagen ${i + 1}`}
                    onClick={() => goToImage(i)}
                  >
                    <img
                      src={img}
                      alt={`${product.name} - Vista ${i + 1}`}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info column */}
          <div
            className="product-info-col reveal-item is-visible"
            style={{ transitionDelay: "0.15s" }}
          >
            <p className="brand">{product.brand}</p>
            <h1 className="title">{product.name}</h1>

            <div className="price-container">
              {hasDiscount ? (
                <>
                  <span className="current-price">${product.sale_price}</span>
                  <span className="original-price">${product.price}</span>
                </>
              ) : (
                <span className="current-price">${product.price}</span>
              )}
            </div>

            {product.description && (
              <div className="description">
                <p>{product.description}</p>
              </div>
            )}

            {/* Variants */}
            {activeVariants.length > 0 && (
              <div className="product-variants">
                <h3 className="variants-title">Selecciona una opción:</h3>
                <div className="variants-grid">
                  {activeVariants.map((v) => {
                    const isOos = v.stock === 0;
                    const label =
                      v.variante1 + (v.variante2 ? ` - ${v.variante2}` : "");
                    const isSelected = selectedVariantId === String(v.id);
                    return (
                      <button
                        key={v.id}
                        className={`variant-btn${isOos ? " disabled" : ""}${isSelected ? " selected" : ""}`}
                        disabled={isOos}
                        onClick={() => {
                          setSelectedVariantId(String(v.id));
                          setSelectedVariantName(label);
                          setVariantError(false);
                        }}
                      >
                        {label}
                        {isOos ? " (Agotado)" : ""}
                      </button>
                    );
                  })}
                </div>
                {variantError && (
                  <p
                    style={{
                      color: "#ff4d4d",
                      marginTop: "10px",
                      fontSize: "0.9rem",
                    }}
                  >
                    Por favor, selecciona una opción antes de añadir al
                    carrito.
                  </p>
                )}
              </div>
            )}

            {/* Specs */}
            {details && Object.keys(details).length > 0 && (
              <div className="product-details">
                <h3 className="details-title">Especificaciones</h3>
                <ul className="details-list">
                  {Object.entries(details).map(([key, value]) => (
                    <li key={key}>
                      <span className="detail-key">{key}:</span>
                      <span className="detail-value">{String(value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button className="add-to-cart-btn" onClick={handleAddToCart}>
              AÑADIR AL CARRITO
            </button>
          </div>
        </div>
      </main>

      {/* ── Related products ── */}
      {related.length > 0 && (
        <div className="related-wrapper container">
          <section className="store-section">
            <div className="category-header">
              <h2 className="section-title">También te puede gustar</h2>
              {product._categoryId && (
                <a
                  href={`/category/${product._categoryId}`}
                  className="category-link"
                >
                  Ver todo{" "}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              )}
            </div>
            <div className="products-grid">
              {related.map((rp) => (
                <RelatedCard key={rp.id} product={rp} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
