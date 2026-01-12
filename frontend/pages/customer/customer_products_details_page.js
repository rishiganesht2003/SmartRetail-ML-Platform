"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductDetailsNavbar from "@/components/navigation/customer/ProductDetailsNavbar";
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

export default function ProductDetailsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const productId = params.get("id");

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wishLoading, setWishLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [cartMsg, setCartMsg] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isInCart, setIsInCart] = useState(false);

  /* ======================
     AUTH + LOAD PRODUCT
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/");
      return;
    }

    if (!productId) return;

    async function loadProduct() {
      setLoading(true);
      setError("");

      const res = await apiFetch(
        `/api/catalog/products/${productId}/`
      );

      if (res.ok) {
        setProduct(res.data);
      } else {
        setError("Product not found");
      }

      setLoading(false);
    }

    loadProduct();
  }, [productId, router]);

  // best-effort check if this product is already in the user's wishlist
  useEffect(() => {
    async function checkWishlist() {
      try {
        const w = await apiFetch("/api/catalog/wishlist/");
        if (w.ok && Array.isArray(w.data)) {
          const found = w.data.find((it) => String(it.product_id || it.id) === String(productId));
          if (found) setIsWishlisted(true);
        }
      } catch (e) {}
    }

    if (productId) checkWishlist();
  }, [productId]);

  // Check if product is already in cart (for persistence across page refreshes)
  useEffect(() => {
    if (!productId) return;
    
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const isAlreadyInCart = cart.some((item) => item.id === Number(productId) || item.id === productId);
    setIsInCart(isAlreadyInCart);
  }, [productId]);

  /* ======================
     CART
  ====================== */
  const addToCart = () => {
    setCartMsg("");

    let q = parseInt(quantity, 10) || 1;
    if (q < 1) q = 1;
    if (product.stock && q > Number(product.stock)) q = Number(product.stock);

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");

    const existing = cart.find((c) => c.id === product.id);
    if (existing) {
      existing.qty = (existing.qty || 1) + q;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.current_price ?? product.price,
        image: product.image,
        qty: q,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    setIsInCart(true);
    setCartMsg("🛒 Added to Cart");
    
    // Clear message after 2 seconds
    setTimeout(() => setCartMsg(""), 2000);
  };

  const buyNow = () => {

    let q = parseInt(quantity, 10) || 1;
    if (q < 1) q = 1;
    if (product.stock && q > Number(product.stock)) q = Number(product.stock);

    localStorage.setItem(
      "cart",
      JSON.stringify([
        {
          id: product.id,
          name: product.name,
          price: product.current_price ?? product.price,
          image: product.image,
          qty: q,
        },
      ])
    );

    router.push("/customer/customer_saved_addresses");
  };

  const incQty = () => {
    setQuantity((q) => {
      let n = parseInt(q, 10) || 1;
      n = n + 1;
      if (product.stock && n > Number(product.stock)) n = Number(product.stock);
      return n;
    });
  };

  const decQty = () => {
    setQuantity((q) => {
      let n = parseInt(q, 10) || 1;
      n = n - 1;
      if (n < 1) n = 1;
      return n;
    });
  };

  /* ======================
     WISHLIST
  ====================== */
  const addToWishlist = async () => {
    if (wishLoading) return;

    setWishLoading(true);
    setMsg("");

    try {
      if (isWishlisted) {
        const res = await apiFetch("/api/catalog/wishlist/remove/", {
          method: "POST",
          body: { product_id: product.id },
        });
        if (res.ok) {
          setIsWishlisted(false);
          setMsg("Removed from wishlist");
        } else {
          setError("Failed to remove from wishlist");
        }
      } else {
        const res = await apiFetch("/api/catalog/wishlist/add/", {
          method: "POST",
          body: { product_id: product.id },
        });
        if (res.ok) {
          setIsWishlisted(true);
          setMsg("❤️ Added to wishlist");
        } else {
          setError("Failed to add to wishlist");
        }
      }
    } catch (e) {
      setError("Wishlist action failed");
    }

    setWishLoading(false);
  };

  /* ======================
     UI STATES
  ====================== */
  if (loading) {
    return <div className="page">Loading product…</div>;
  }

  if (error || !product) {
    return <div className="page errorText">{error || "Error"}</div>;
  }

  const currentPrice =
    product.current_price ?? product.price;

  const oldPrice =
    product.base_price &&
    Number(product.base_price) > Number(currentPrice)
      ? product.base_price
      : null;

  const showAIBadge =
    product.price_source === "dynamic" ||
    product.price_source === "cached";

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      <ProductDetailsNavbar />

      <div className="detailsContainer" style={{ background: "linear-gradient(135deg, rgba(98,70,234,0.03) 0%, rgba(155,92,255,0.02) 100%)", borderRadius: "24px", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
        {/* IMAGE */}
        <div className="detailsImage" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, var(--card) 0%, rgba(98,70,234,0.05) 100%)", boxShadow: "0 24px 56px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
          <img
            src={product.image || "/placeholder.png"}
            alt={product.name}
            style={{ transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)" }}
            onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
            onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
          />
        </div>

        {/* INFO */}
        <div className="detailsInfo" style={{ gap: "6px" }}>
          <div className="titleRow">
            <h1 className="productTitle" style={{ fontSize: "2rem", fontWeight: "900", background: "linear-gradient(135deg, var(--text-strong) 0%, var(--accent) 100%)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "2px" }}>{product.name}</h1>
          </div>

          {showAIBadge && (
            <div className="aiBadge" style={{ background: "linear-gradient(135deg, #a78bfa22 0%, #c4b5fd22 100%)", padding: "6px 12px", borderRadius: "10px", border: "1px solid #c4b5fd55", display: "inline-block", width: "fit-content", fontWeight: "700", fontSize: "12px", color: "var(--accent)", marginTop: "2px" }}>✨ AI Price Adjusted</div>
          )}

          {product.rating > 0 && (
            <div className="rating" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--muted)", marginTop: "2px" }}>
              <span>⭐ {Number(product.rating).toFixed(1)}</span>
              <span style={{ color: "var(--muted-strong)", fontWeight: "600" }}>({product.rating_count} reviews)</span>
            </div>
          )}

          <div className="productCat" style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.4px", marginTop: "0px" }}>{product.category}</div>

          <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, var(--border), transparent)", margin: "8px 0" }} />

          <div className="priceRow" style={{ gap: "12px", alignItems: "baseline", marginTop: "6px" }}>
            <span className="price" style={{ fontSize: "2.2rem", fontWeight: "900", color: "var(--accent)", textShadow: "0 4px 12px rgba(98,70,234,0.2)" }}>
              {formatINR(currentPrice)}
            </span>

            {oldPrice && (
              <>
                <span className="priceOld" style={{ fontSize: "1rem", textDecoration: "line-through", color: "var(--muted)", fontWeight: "500" }}>
                  {formatINR(oldPrice)}
                </span>
                <span className="offerTag" style={{ background: "linear-gradient(135deg, #10b98133, #34d39933)", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", color: "#10b981", border: "1px solid #10b98155" }}>
                  SAVE {Math.round(((oldPrice - currentPrice) / oldPrice) * 100)}%
                </span>
              </>
            )}
          </div>

          <p className="description" style={{ color: "var(--muted-strong)", lineHeight: "1.6", margin: "8px 0", fontSize: "13px", fontWeight: "500" }}>
            {product.description || "No description available"}
          </p>

          <div className="qtyRow" style={{ marginTop: "10px", padding: "8px 12px", background: "var(--ui-surface)", borderRadius: "8px", border: "1px solid var(--border)", gap: "8px" }}>
            <label className="qtyLabel" style={{ fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap" }}>Quantity</label>
            <div className="qtyBox" style={{ marginLeft: "auto", gap: "4px" }}>
              <input
                className="qtyInput"
                type="number"
                min={1}
                max={product.stock ?? undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ width: "60px", padding: "6px 10px", borderRadius: "6px", border: "1.2px solid var(--border)", background: "var(--card)", color: "var(--text-strong)", fontWeight: "700", textAlign: "center", fontSize: "13px" }}
              />

              <div className="qtyControls" style={{ display: "flex", gap: "3px" }}>
                <button 
                  className="qtyBtn" 
                  onClick={incQty} 
                  aria-label="Increase quantity"
                  style={{ width: "32px", height: "32px", padding: "0", borderRadius: "6px", border: "1.2px solid var(--border)", background: "linear-gradient(135deg, var(--card) 0%, rgba(98,70,234,0.04) 100%)", color: "var(--accent)", fontWeight: "700", cursor: "pointer", transition: "all 0.2s", fontSize: "12px" }}
                  onMouseEnter={(e) => { e.target.style.background = "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)"; e.target.style.color = "white"; e.target.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.target.style.background = "linear-gradient(135deg, var(--card) 0%, rgba(98,70,234,0.04) 100%)"; e.target.style.color = "var(--accent)"; e.target.style.transform = "translateY(0)"; }}
                >▲</button>
                <button 
                  className="qtyBtn" 
                  onClick={decQty} 
                  aria-label="Decrease quantity"
                  style={{ width: "32px", height: "32px", padding: "0", borderRadius: "6px", border: "1.2px solid var(--border)", background: "linear-gradient(135deg, var(--card) 0%, rgba(98,70,234,0.04) 100%)", color: "var(--accent)", fontWeight: "700", cursor: "pointer", transition: "all 0.2s", fontSize: "12px" }}
                  onMouseEnter={(e) => { e.target.style.background = "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)"; e.target.style.color = "white"; e.target.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.target.style.background = "linear-gradient(135deg, var(--card) 0%, rgba(98,70,234,0.04) 100%)"; e.target.style.color = "var(--accent)"; e.target.style.transform = "translateY(0)"; }}
                >▼</button>
              </div>
            </div>
          </div>

          <div className="buttonsRow" style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button
              className="btn secondary"
              onClick={addToWishlist}
              disabled={wishLoading}
              aria-label="Add to wishlist"
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "12px 14px", borderRadius: "10px", border: "1.2px solid var(--border)", background: "linear-gradient(135deg, var(--card) 0%, rgba(98,70,234,0.08) 100%)", color: "var(--text-strong)", fontWeight: "700", fontSize: "13px", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
              onMouseEnter={(e) => { e.target.style.background = "linear-gradient(135deg, #f3e8ff 0%, rgba(98,70,234,0.15) 100%)"; e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 12px 24px rgba(98,70,234,0.15)"; }}
              onMouseLeave={(e) => { e.target.style.background = "linear-gradient(135deg, var(--card) 0%, rgba(98,70,234,0.08) 100%)"; e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)"; }}
            >
              {isWishlisted ? "❤️" : "🤍"} {isWishlisted ? "Wishlisted" : "Wishlist"}
            </button>

            <button 
              className="btn primary" 
              onClick={isInCart ? () => router.push("/customer/customer_cart") : addToCart} 
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "12px 14px", borderRadius: "10px", border: "none", background: cartMsg ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : isInCart ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" : "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", boxShadow: cartMsg ? "0 12px 32px rgba(16,185,129,0.25)" : isInCart ? "0 12px 32px rgba(37,99,235,0.25)" : "0 12px 32px rgba(98,70,234,0.25)", textShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
              onMouseEnter={(e) => { if (!cartMsg && !isInCart) { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 20px 48px rgba(98,70,234,0.35)"; } else if (!cartMsg && isInCart) { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 20px 48px rgba(37,99,235,0.35)"; } }}
              onMouseLeave={(e) => { if (!cartMsg && !isInCart) { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 12px 32px rgba(98,70,234,0.25)"; } else if (!cartMsg && isInCart) { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 12px 32px rgba(37,99,235,0.25)"; } }}
            >
              {cartMsg ? cartMsg : isInCart ? "🛒 Go to Cart" : "🛒 Add to Cart"}
            </button>

            <button 
              className="btn primary" 
              onClick={buyNow} 
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "12px 14px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 12px 32px rgba(139,92,246,0.25)", textShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
              onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 20px 48px rgba(139,92,246,0.35)"; }}
              onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 12px 32px rgba(139,92,246,0.25)"; }}
            >
              ⚡ Buy Now
            </button>
          </div>

          <div className="stockBox" style={{ marginTop: "10px", padding: "8px 12px", borderRadius: "8px", background: "linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)", color: "#166534", fontWeight: "700", fontSize: "12px", border: "1px solid #86efac", display: "inline-block", boxShadow: "0 4px 12px rgba(34,197,94,0.1)" }}>
            ✓ In Stock: {product.stock ?? 0} units
          </div>

          {msg && <div className="successText" style={{ marginTop: "8px", padding: "8px 12px", borderRadius: "8px", background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)", color: "#1e40af", fontWeight: "600", fontSize: "12px", border: "1px solid #93c5fd" }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
