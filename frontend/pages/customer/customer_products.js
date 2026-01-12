"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerNavbar from "@/components/navigation/customer/CustomerNavbar";
import { apiFetch } from "@/lib/api";

/* ======================
   Helpers
====================== */
function formatINR(value) {
  return (
    "₹" +
    Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function getPriceLabel(product) {
  if (product.current_price && product.base_price) {
    const savings = Math.round(
      ((product.base_price - product.current_price) / product.base_price) * 100
    );
    if (savings > 0) return `${savings}% OFF`;
  }
  return null;
}

function getPriceSavings(basePrice, displayPrice) {
  if (basePrice && displayPrice && basePrice > displayPrice) {
    const savings = Math.round(basePrice - displayPrice);
    return `Save ₹${savings}`;
  }
  return null;
}

export default function CustomerProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ======================
     AUTH CHECK (OPTIONAL VIEW)
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      // Customer can browse products without login
      // Wishlist / Cart actions will require login
      return;
    }
  }, []);

  /* ======================
     LOAD PRODUCTS
  ====================== */
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);

      const res = await apiFetch("/api/catalog/products/");
      if (res.ok && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setProducts([]);
      }

      setLoading(false);
    }

    loadProducts();
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

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      <CustomerNavbar active="products" />

      <div className="productsPage">
        <div className="productsContainer">
          {/* Page Header */}
          <div className="pageHeader">
            <h1>🛍️ All Products</h1>
            <p className="subtitle">Discover our complete collection</p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loadingState">
              <div className="spinner">⏳</div>
              <p>Loading products…</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && products.length === 0 && (
            <div className="emptyStateProducts">
              <div className="emptyIcon">📭</div>
              <div className="emptyTitle">No Products Available</div>
              <p>Please check back later for more items</p>
            </div>
          )}

          {/* Products Grid */}
          {!loading && products.length > 0 && (
            <div className="productsGrid">
              {products.map((p) => {
                const priceLabel = getPriceLabel(p);
                const displayPrice = p.current_price || p.price || 0;
                const basePrice = p.base_price || p.price || 0;
                const savings = getPriceSavings(basePrice, displayPrice);
                const stockValue = parseInt(p.stock, 10) || 0;
                const isOutOfStock = stockValue <= 0;

                return (
                  <div key={p.id} className="productCardEnhanced">
                    {/* Image Container */}
                    <div className="productImageContainer">
                      <img
                        src={p.image || "/placeholder.png"}
                        alt={p.name}
                        className="productImage"
                        loading="lazy"
                      />
                      
                      {/* Price Badge */}
                      {priceLabel && (
                        <div className="priceBadge">{priceLabel}</div>
                      )}

                      {/* Wishlist Button */}
                      {!isOutOfStock && (
                        <button
                          className="wishlistBtn"
                          onClick={() => addToWishlist(p.id)}
                          title="Add to wishlist"
                        >
                          ❤️
                        </button>
                      )}

                      {/* Stock Status */}
                      {isOutOfStock && (
                        <div className="outOfStockOverlay">Out of Stock</div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="productCardBody">
                      <h3 className="productCardName">{p.name}</h3>
                      
                      <p className="productCategory">{p.category}</p>

                      {/* Rating */}
                      {p.rating && p.rating > 0 && (
                        <div className="ratingSection">
                          <span className="ratingStars">⭐ {Number(p.rating).toFixed(1)}</span>
                          <span className="ratingCount">({p.rating_count})</span>
                        </div>
                      )}

                      {/* Stock Status */}
                      <div className={`stockStatus ${isOutOfStock ? 'outOfStock' : 'inStock'}`}>
                        {isOutOfStock
                          ? "❌ Out of Stock"
                          : stockValue > 10
                          ? "✅ In Stock"
                          : `⚠️ Only ${stockValue} left!`}
                      </div>

                      {/* Price Section */}
                      <div className="priceContainer">
                        <span className="displayPrice">
                          {formatINR(displayPrice)}
                        </span>
                        {savings && (
                          <span className="savingsText">{savings}</span>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        className={`viewBtn ${isOutOfStock ? 'disabled' : ''}`}
                        onClick={() =>
                          !isOutOfStock &&
                          router.push(
                            `/customer/customer_products_details_page?id=${p.id}`
                          )
                        }
                        disabled={isOutOfStock}
                      >
                        {isOutOfStock ? "Out of Stock" : "View & Add to Cart"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
