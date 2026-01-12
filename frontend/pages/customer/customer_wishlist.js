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

export default function CustomerWishlistPage() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cartItems, setCartItems] = useState(new Set());

  /* ======================
     AUTH + LOAD WISHLIST
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/");
      return;
    }
    loadWishlist();
  }, [router]);

  async function loadWishlist() {
    setError("");
    const res = await apiFetch("/api/catalog/wishlist/");
    if (res.ok) {
      setItems(res.data || []);
    } else {
      setError("Failed to load wishlist");
    }
    
    // Update cart items state
    updateCartItemsState();
  }

  // Helper function to update which items are in the cart
  function updateCartItemsState() {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const cartIds = new Set(cart.map((item) => item.id));
    setCartItems(cartIds);
  }

  /* ======================
     CART HELPERS
  ====================== */
  const addToCart = (product) => {
    setSuccess("");
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");

    const existing = cart.find((p) => p.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    setSuccess("🛒 Added to cart");
    
    // Update cart items state
    updateCartItemsState();
    
    // Clear message after 2 seconds
    setTimeout(() => setSuccess(""), 2000);
  };

  const buyNow = (product) => {
    localStorage.setItem(
      "cart",
      JSON.stringify([{ ...product, qty: 1 }])
    );
    router.push("/customer/customer_saved_addresses");
  };

  /* ======================
     REMOVE FROM WISHLIST
  ====================== */
  const removeItem = async (id) => {
    setSuccess("");
    const res = await apiFetch("/api/catalog/wishlist/remove/", {
      method: "POST",
      body: { product_id: id },
    });

    if (res.ok) {
      loadWishlist();
    } else {
      setError("Failed to remove item");
    }
  };

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      <CustomerNavbar active="wishlist" />

      <div className="wishlistPage">
        <div className="wishlistContainer">
          {/* Header Section */}
          <div className="pageHeader">
            <h2>❤️ My Wishlist</h2>
            <p className="subtitle">Your favorite items, all in one place</p>
          </div>

          {/* Messages */}
          {error && <div className="errorText">{error}</div>}
          {success && <div className="successText">{success}</div>}

          {/* Wishlist Content */}
          {items.length === 0 ? (
            <div className="emptyStateWishlist">
              <div className="emptyIcon">🛍️</div>
              <div className="emptyTitle">No Items Yet</div>
              <p>Start adding items to your wishlist!</p>
              <button 
                className="btn primary"
                onClick={() => router.push("/customer/customer_products")}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              <div className="itemCountBadge">
                {items.length} {items.length === 1 ? "item" : "items"}
              </div>
              <div className="wishlistGrid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "18px" }}>
                {items.map((p) => (
                  <div key={p.id} className="wishlistCard">
                    <div className="cardImage">
                      <img
                        src={p.image || "/placeholder.png"}
                        alt={p.name}
                      />
                      <button 
                        className="removeBtn"
                        onClick={() => removeItem(p.id)}
                        title="Remove from wishlist"
                      >
                        ❌
                      </button>
                    </div>

                    <div className="cardContent">
                      <h3 className="productName">{p.name}</h3>
                      <p className="productCategory">{p.category}</p>

                      <div className="priceSection">
                        <div className="productPrice">
                          {formatINR(p.price)}
                        </div>
                      </div>

                      <div className="cardActions">
                        <button
                          className="btn cartBtn"
                          onClick={cartItems.has(p.id) ? () => router.push("/customer/customer_cart") : () => addToCart(p)}
                          style={{ background: cartItems.has(p.id) ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" : "", boxShadow: cartItems.has(p.id) ? "0 12px 32px rgba(37,99,235,0.25)" : "" }}
                        >
                          {cartItems.has(p.id) ? "🛒 Go to Cart" : "🛒 Add to Cart"}
                        </button>

                        <button
                          className="btn primary buyBtn"
                          onClick={() => buyNow(p)}
                        >
                          ⚡ Buy Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
