"use client";

import { useEffect, useState, useRef } from "react";
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

const SHIPPING = 10;

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

export default function CustomerCartPage() {
  const router = useRouter();

  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [draftQty, setDraftQty] = useState({});
  const [subtotal, setSubtotal] = useState(0);
  const productGridRef = useRef(null);
  const summaryRef = useRef(null);

  /* ======================
     AUTH CHECK
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.push("/");
    }
  }, [router]);

  /* ======================
     LOAD CART
  ====================== */
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    setCart(stored);
  }, []);

  /* ======================
     LOAD PRODUCTS (suggestions)
  ====================== */
  useEffect(() => {
    async function loadProducts() {
      const res = await apiFetch("/api/catalog/products/");
      if (res.ok && Array.isArray(res.data)) {
        setProducts(res.data);
      }
    }
    loadProducts();
  }, []);

  /* ======================
     CALCULATE SUBTOTAL
  ====================== */
  useEffect(() => {
    const total = cart.reduce((sum, item) => {
      return (
        sum +
        Number(item.price || 0) *
          Number(item.qty || 1)
      );
    }, 0);
    setSubtotal(total);
  }, [cart]);

  /* ======================
     CART ACTIONS
  ====================== */
  const updateQty = (index) => {
    const q = parseInt(draftQty[index], 10);
    if (!q || q < 1) {
      alert("Quantity must be at least 1");
      return;
    }

    const updated = [...cart];
    updated[index] = {
      ...updated[index],
      qty: q,
    };

    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
  };

  const removeItem = (index) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
  };

  const addToCart = (p) => {
    const stockValue = parseInt(p.stock, 10) || 0;
    if (stockValue <= 0) {
      alert("Cannot add — product is out of stock");
      return;
    }

    const updated = [...cart];
    const existing = updated.find((i) => i.id === p.id);

    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      updated.push({
        id: p.id,
        name: p.name,
        price: p.current_price || p.price,
        image: p.image,
        qty: 1,
      });
    }

    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
  };

  const proceedCheckout = () => {
    router.push("/customer/customer_saved_addresses");
  };

  const total =
    subtotal + (cart.length ? SHIPPING : 0);

  const cartIds = cart.map((i) => i.id);
  const suggested = products.filter(
    (p) => !cartIds.includes(p.id)
  );

  /* Adjust summary width to harmonize with product grid columns */
  useEffect(() => {
    function adjustSummary() {
      const grid = productGridRef.current;
      const summary = summaryRef.current;
      if (!grid || !summary) return;

      const container = grid.closest('.cartContainer') || grid.parentElement;
      const containerRect = container ? container.getBoundingClientRect() : { width: window.innerWidth };
      const gridRect = grid.getBoundingClientRect();
      const gridGap = parseFloat(window.getComputedStyle(grid).columnGap || 20);

      // determine card width from first child if present
      const firstCard = grid.querySelector('.cartCard');
      const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : Math.floor((gridRect.width - gridGap * 3) / 4);

      // If fewer than 4 products, match the visible product grid width
      if (cart.length < 4) {
        summary.style.width = `${Math.round(gridRect.width)}px`;
      } else {
        // 3 or more (per spec) -> expand to maximum grid width aligned to 4 columns
        const targetCols = 4;
        const targetWidth = Math.min(containerRect.width, Math.round(cardWidth * targetCols + gridGap * (targetCols - 1)));
        summary.style.width = `${targetWidth}px`;
      }
      summary.style.margin = '20px auto';
    }

    adjustSummary();
    window.addEventListener('resize', adjustSummary);
    return () => window.removeEventListener('resize', adjustSummary);
  }, [cart.length]);

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      <CustomerNavbar active="cart" />

      {/* EMPTY CART */}
      {cart.length === 0 ? (
        <div className="wrapper">
          <div className="emptyBox">
            <div className="emptyIcon">🛍️</div>
            <h2>Your cart is empty</h2>
            <button
              className="primaryBtn"
              onClick={() =>
                router.push("/customer/customer_products")
              }
            >
              Browse Products
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* CART ITEMS */}
          <div className="cartContainer">
            <div className="productGrid" ref={productGridRef}>
              {cart.map((item, i) => (
                <div key={item.id} className="cartCard">
                  <div className="imageWrap">
                    <img src={item.image || "/placeholder.png"} className="cartImage" alt={item.name} />
                  </div>

                  <div className="itemInfo">
                    <div className="itemName">{item.name}</div>

                    <div className="priceQtyRow">
                      <div className="itemPrice">{formatINR(item.price)}</div>

                      <div className="qtyRemoveGroup">
                        <div className="qtyBox">
                          <label className="qtyLabel">Qty</label>
                          <input
                            type="number"
                            min={1}
                            aria-label={`Quantity for ${item.name}`}
                            value={draftQty[i] ?? item.qty ?? 1}
                            onChange={(e) => setDraftQty((p) => ({ ...p, [i]: e.target.value }))}
                            className="qtyInput"
                          />
                        </div>

                        <button
                          className="btnIcon removeBtn"
                          aria-label={`Remove ${item.name} from cart`}
                          onClick={() => removeItem(i)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="cartActions">
                      <button onClick={() => updateQty(i)} className="btnSm updateBtn">Update</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SUMMARY */}
            <aside className="cartSummary" ref={summaryRef}>
              <div className="summaryRow">
                <span>Subtotal</span>
                <strong>{formatINR(subtotal)}</strong>
              </div>
              <div className="summaryRow">
                <span>Shipping</span>
                <span>{formatINR(SHIPPING)}</span>
              </div>
              <div className="summaryTotal">
                <span>Total</span>
                <strong>{formatINR(total)}</strong>
              </div>

              <button
                className="checkoutBtn"
                onClick={proceedCheckout}
              >
                Proceed to Address →
              </button>
            </aside>
          </div>

          {/* SUGGESTED PRODUCTS */}
          {suggested.length > 0 && (
              <div className="recommendSection">
              <h3>✨ You may also like</h3>

              <div className="recommendGrid">
                {suggested.slice(0, 5).map((p) => {
                  const priceLabel = getPriceLabel(p);
                  const displayPrice = p.current_price || p.price || 0;
                  const basePrice = p.base_price || p.price || 0;
                  const savings = getPriceSavings(basePrice, displayPrice);
                  const stockValue = parseInt(p.stock, 10) || 0;
                  const isOutOfStock = stockValue <= 0;
                  return (
                    <div key={p.id} className="productCard">
                      <div className="imageWrap">
                        <img src={p.image || "/placeholder.png"} alt={p.name} className="productImage" loading="lazy" />
                      </div>

                      <div className="cardBody">
                        <div className="aiBadge">AI Priced</div>

                        {priceLabel && <div className="priceLabel">{priceLabel}</div>}

                        <div className="productName">{p.name}</div>
                        <div className="productCat">{p.category}</div>

                        {p.rating && p.rating > 0 && <div className="rating">⭐ {Number(p.rating).toFixed(1)} ({p.rating_count})</div>}

                        <div className={`stockInfo ${stockValue > 0 ? 'in' : 'out'}`}>
                          {stockValue > 0 ? (stockValue > 10 ? '✅ In Stock' : `⚠️ Only ${stockValue} left!`) : '❌ Out of Stock'}
                        </div>

                        <div className="priceRow">
                          <div className="displayPrice">{formatINR(displayPrice)}</div>
                          {savings && <div className="savings">{savings}</div>}
                        </div>

                        <div className="cardActions">
                          <button className="btnOutline" onClick={() => !isOutOfStock && addToCart(p)} disabled={isOutOfStock}>➕ Add</button>
                          <button className="addBtn" onClick={() => !isOutOfStock && router.push(`/customer/customer_products_details_page?id=${p.id}`)} disabled={isOutOfStock}>👁 View</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
