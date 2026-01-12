"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerNavbar from "@/components/navigation/customer/CustomerNavbar";
import { apiFetch } from "@/lib/api";

function formatINR(value) {
  if (!value) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(value);
}

function getPriceLabel(product) {
  if (!product.price_source || product.price_source === "manual") return null;
  if (product.price_source === "dynamic") return "🤖 AI Priced";
  return null;
}

function getPriceSavings(basePrice, currentPrice) {
  if (!basePrice || !currentPrice || basePrice <= currentPrice) return null;
  const saving = basePrice - currentPrice;
  const percent = ((saving / basePrice) * 100).toFixed(0);
  return `${percent}% off`;
}

export default function CustomerHomePage() {
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [userSegment, setUserSegment] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingReco, setLoadingReco] = useState(true);

  /* ======================
     Load Products
  ====================== */
  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await apiFetch("/api/catalog/products/");
      if (res.ok && Array.isArray(res.data)) {
        setProducts(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  /* ======================
     Load Recommendations
  ====================== */
  useEffect(() => {
    // Fetch user segment and personalized recommendations (requires auth)
    async function loadReco() {
      setLoadingReco(true);
      try {
        // get segment (may return 401 if anonymous)
        const segRes = await apiFetch("/api/ml/segmentation/my-segment/");
        if (segRes.ok) {
          setUserSegment(segRes.data.segment || null);
        }

        // request recommended products for authenticated user
        const recRes = await apiFetch(
          "/api/ml/recommendations/recommended/?limit=6"
        );
        if (recRes.ok && Array.isArray(recRes.data)) {
          setRecommended(recRes.data);
        }
      } catch (e) {
        // ignore for anonymous users
      } finally {
        setLoadingReco(false);
      }
    }

    loadReco();
  }, []);

  /* ======================
     WISHLIST ACTION
  ====================== */
  const addToWishlist = async (productId) => {
    if (!localStorage.getItem("access")) {
      alert("Please login to use wishlist");
      router.push("/");
      return;
    }

    const res = await apiFetch("/api/catalog/wishlist/add/", {
      method: "POST",
      body: { product_id: productId },
    });

    if (res.ok) {
      alert("❤️ Added to wishlist");
    } else {
      alert("Failed to add to wishlist");
    }
  };

  const visibleProducts = showAll ? products : products.slice(0, 4);
  const inStockRecommended = recommended.filter((r) => parseInt(r.stock, 10) > 0);

  /* ======================
     Render
  ====================== */
  return (
    <div className="root">
      {/* NAVBAR */}
      <CustomerNavbar active="home" />

      {/* ================= HERO SECTION ================= */}
      <section className="heroSection">
        <div className="heroContent" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "40px" }}>
          <div className="heroText">
            <h1 className="heroTitle">✨ Welcome to Smart Retail</h1>
            <p className="heroSubtitle">
              AI-powered shopping with dynamic pricing & personalized recommendations
            </p>
          </div>
          {userSegment && (
            <div style={{ background: "var(--card)", color: "var(--text)", padding: "12px 20px", borderRadius: "8px", fontWeight: "600", whiteSpace: "nowrap", fontSize: "14px", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)" }}>
              Your Segment: <strong style={{ color: "var(--accent)", fontSize: "15px" }}>{userSegment}</strong>
            </div>
          )}
        </div>
      </section>

      {/* ================= MAIN CONTENT ================= */}
      <main className="homePage">
        <div className="homeContainer">
          {/* Recommended Products Section */}
          {!loadingReco && inStockRecommended.length > 0 && (
            <section className="recommendedSection">
              <div className="sectionHeaderHome">
                <div>
                  <h2 className="sectionTitle">✨ Recommended for you</h2>
                  {userSegment && (
                    <p className="sectionSubtitle">Personalized picks for {userSegment}</p>
                  )}
                </div>
              </div>

              <div className="recommendedScroll">
                {inStockRecommended.map((r) => (
                  <div
                    key={r.id}
                    className="recommendedCard"
                    onClick={() =>
                      router.push(
                        `/customer/customer_products_details_page?id=${r.id}`
                      )
                    }
                  >
                    <div className="recCardImage">
                      <img
                        src={r.image || "/placeholder.png"}
                        alt={r.name}
                      />
                    </div>
                    <div className="recCardContent">
                      <h4 className="recProductName">{r.name}</h4>
                      <p className="recProductPrice">
                        {formatINR(r.price || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Featured Products Section */}
          <section className="featuredSection">
            <div className="sectionHeaderHome">
              <h2 className="sectionTitle">✨ Featured Products</h2>
              {products.length > 4 && (
                <button 
                  className="viewAllBtn"
                  onClick={() => setShowAll((p) => !p)}
                >
                  {showAll ? "Show Less" : "View All"}
                </button>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="loadingStateHome">
                <span className="loadingSpinner">⏳</span>
                <p>Loading products…</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && products.length === 0 && (
              <div className="emptyStateHome">
                <div className="emptyIconHome">📭</div>
                <p>No products available yet.</p>
              </div>
            )}

            {/* Products Grid */}
            {!loading && products.length > 0 && (
              <div className="homeProductsGrid">
                {visibleProducts.map((p) => {
                  const priceLabel = getPriceLabel(p);
                  const displayPrice = p.current_price || p.price || 0;
                  const basePrice = p.base_price || p.price || 0;
                  const savings = getPriceSavings(basePrice, displayPrice);
                  const stockValue = parseInt(p.stock, 10) || 0;
                  const isOutOfStock = stockValue <= 0;

                  return (
                    <div key={p.id} className="homeProductCard">
                      {/* Image */}
                      <div className="homeCardImage">
                        <img
                          src={p.image || "/placeholder.png"}
                          alt={p.name}
                        />

                        {/* Badge */}
                        {priceLabel && (
                          <div className="homeCardBadge">{priceLabel}</div>
                        )}

                        {/* Wishlist */}
                        {!isOutOfStock && (
                          <button
                            className="homeWishlistBtn"
                            onClick={() => addToWishlist(p.id)}
                          >
                            ❤️
                          </button>
                        )}

                        {/* Out of Stock */}
                        {isOutOfStock && (
                          <div className="homeOutOfStock">Out of Stock</div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="homeCardBody">
                        <h3 className="homeProductName">{p.name}</h3>
                        <p className="homeProductCat">{p.category}</p>

                        {/* Rating */}
                        {p.rating && p.rating > 0 && (
                          <div className="homeRating">
                            ⭐ {Number(p.rating).toFixed(1)} ({p.rating_count})
                          </div>
                        )}

                        {/* Stock */}
                        <div
                          className={`homeStockStatus ${
                            isOutOfStock ? "outOfStock" : "inStock"
                          }`}
                        >
                          {isOutOfStock
                            ? "❌ Out of Stock"
                            : stockValue > 10
                            ? "✅ In Stock"
                            : `⚠️ Only ${stockValue} left!`}
                        </div>

                        {/* Price */}
                        <div className="homePriceRow">
                          <span className="homePrice">
                            {formatINR(displayPrice)}
                          </span>
                          {savings && (
                            <span className="homeSavings">{savings}</span>
                          )}
                        </div>

                        {/* Button */}
                        <button
                          className={`homeViewBtn ${
                            isOutOfStock ? "disabled" : ""
                          }`}
                          onClick={() =>
                            !isOutOfStock &&
                            router.push(
                              `/customer/customer_products_details_page?id=${p.id}`
                            )
                          }
                          disabled={isOutOfStock}
                        >
                          {isOutOfStock
                            ? "Out of Stock"
                            : "View & Add to Cart"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
