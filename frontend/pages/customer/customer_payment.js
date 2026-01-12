"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetailsNavbar from "@/components/navigation/customer/ProductDetailsNavbar";
import { apiFetch } from "@/lib/api";

export default function CustomerPaymentPage() {
  const router = useRouter();

  /* ======================
     UI STATE
  ====================== */
  const [loading, setLoading] = useState(false);
  const [payMethod, setPayMethod] = useState("UPI");
  const [walletBalance, setWalletBalance] = useState(0);

  /* ======================
     PAYMENT INPUTS
  ====================== */
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState({
    number: "",
    expiry: "",
    cvv: "",
    bank: "",
  });

  /* ======================
     COUPONS
  ====================== */
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [allCoupons, setAllCoupons] = useState([]);
  const [suggestedCoupons, setSuggestedCoupons] = useState([]);

  /* ======================
     ORDER DATA
  ====================== */
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);

  /* ======================
     SUMMARY (SAFE)
  ====================== */
  const [summary, setSummary] = useState({
    subtotal: 0,
    shipping: 0,
    tax: 0,
    total: 0,
  });

  /* Calculate original price total */
  const calculateOriginalPrice = () => {
    return items.reduce((sum, item) => {
      const originalPrice = item.basePrice || (item.price / 0.8);
      return sum + (originalPrice * Number(item.qty));
    }, 0);
  };

  const originalPriceTotal = calculateOriginalPrice();
  const discountAmount = originalPriceTotal - summary.subtotal;

  /* ======================
     LOAD TEMP ORDER (✔ FIXED)
  ====================== */
  useEffect(() => {
    const raw = localStorage.getItem("tempOrder");

    if (!raw) {
      router.replace("/customer/customer_cart");
      return;
    }

    try {
      const order = JSON.parse(raw);

      setItems(order.items || []);
      setAddress(order.address || null);

      setSummary({
        subtotal: Number(order.pricing?.subtotal ?? 0),
        shipping: Number(order.pricing?.shipping ?? 0),
        tax: Number(order.pricing?.tax ?? 0),
        total: Number(order.pricing?.total ?? 0),
      });
    } catch (err) {
      console.error("Invalid tempOrder", err);
      router.replace("/customer/customer_cart");
    }
  }, [router]);

  /* ======================
     FETCH AVAILABLE COUPONS
  ====================== */
  useEffect(() => {
    const fetchCoupons = async () => {
      const res = await apiFetch("/api/orders/coupons/");
      if (res.ok) {
        setAllCoupons(res.data || []);
      }
    };
    fetchCoupons();
  }, []);

  /* ======================
     FETCH WALLET BALANCE
  ====================== */
  useEffect(() => {
    const fetchWallet = async () => {
      const res = await apiFetch("/api/accounts/wallet/");
      if (res.ok) {
        setWalletBalance(Number(res.data?.balance_inr ?? 0));
      }
    };
    fetchWallet();
  }, []);

  /* ======================
     FILTER COUPONS BY PAYMENT METHOD
  ====================== */
  useEffect(() => {
    if (allCoupons.length === 0) return;

    const filtered = allCoupons.filter((c) => {
      const methods = c.payment_methods || [];
      return (
        methods.includes("ALL") ||
        methods.includes(payMethod)
      );
    });

    setSuggestedCoupons(filtered);
  }, [payMethod, allCoupons]);

  /* ======================
     APPLY COUPON
  ====================== */
  const applyCoupon = async () => {
    if (!coupon) return;

    const res = await apiFetch("/api/orders/apply-coupon/", {
      method: "POST",
      body: {
        code: coupon,
        payment_method: payMethod,
      },
    });

    if (!res.ok) {
      alert(res.data?.detail || "Invalid coupon");
      return;
    }

    // Backend now returns `discount_amount` and `discount_percent`.
    const amount = Number(res.data?.discount_amount || 0);
    const percent = Number(res.data?.discount_percent || 0);

    let disc = 0;
    if (percent && percent > 0) {
      disc = Math.round((summary.subtotal * percent) * 100) / 10000; // keep two decimals
      // better compute precisely:
      disc = Number((summary.subtotal * percent / 100).toFixed(2));
    } else {
      disc = amount;
    }

    setAppliedCoupon(coupon);
    setDiscount(disc);

    setSummary((prev) => ({
      ...prev,
      total: Math.max(prev.total - disc, 0),
    }));
  };

  /* ======================
     REMOVE COUPON
  ====================== */
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCoupon("");
    setSummary((prev) => ({
      ...prev,
      total: prev.total + discount,
    }));
    setDiscount(0);
  };

  /* ======================
     APPLY SUGGESTED COUPON
  ====================== */
  const applySuggestedCoupon = async (couponCode) => {
    setCoupon(couponCode);
    
    const res = await apiFetch("/api/orders/apply-coupon/", {
      method: "POST",
      body: {
        code: couponCode,
        payment_method: payMethod,
      },
    });

    if (!res.ok) {
      alert(res.data?.detail || "Invalid coupon");
      return;
    }

    const amount = Number(res.data?.discount_amount || 0);
    const percent = Number(res.data?.discount_percent || 0);

    let disc = 0;
    if (percent && percent > 0) {
      disc = Number((summary.subtotal * percent / 100).toFixed(2));
    } else {
      disc = amount;
    }

    setAppliedCoupon(couponCode);
    setDiscount(disc);

    setSummary((prev) => ({
      ...prev,
      total: Math.max(prev.total - disc, 0),
    }));
  };

  /* ======================
     PAY NOW
  ====================== */
  const handlePayNow = async () => {
    if (!address || items.length === 0) return;

    if (payMethod === "UPI" && !upiId) {
      alert("Enter UPI ID");
      return;
    }

    if (
      payMethod === "Card" &&
      (!card.number || !card.expiry || !card.cvv)
    ) {
      alert("Enter complete card details");
      return;
    }

    if (payMethod === "Wallet" && walletBalance < summary.total) {
      alert("Insufficient wallet balance");
      return;
    }

    const payment_meta =
      payMethod === "UPI"
        ? { upi_id: upiId }
        : payMethod === "Card"
        ? {
            card_last4: card.number.slice(-4),
            bank: card.bank,
          }
        : payMethod === "Wallet"
        ? { wallet_used: walletBalance }
        : {};

    setLoading(true);

    const res = await apiFetch("/api/orders/orders/create/", {
      method: "POST",
      body: {
        items,
        address,
        payment_method: payMethod,
        payment_meta,
        coupon: appliedCoupon,
      },
    });

    setLoading(false);

    if (res.ok) {
      localStorage.setItem("lastOrder", JSON.stringify(res.data));
      localStorage.removeItem("cart");
      localStorage.removeItem("tempOrder");
      router.push("/customer/customer_order_success");
    } else {
      alert(res.data?.detail || "Payment failed");
    }
  };

  /* ======================
     SAFE RENDER
  ====================== */
  if (!address || items.length === 0) {
    return <div className="page">Loading payment details…</div>;
  }

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      {loading && <div className="loadingOverlay">Processing…</div>}

      <ProductDetailsNavbar />

      <div className="page paymentPage">
        {/* ================= LEFT ================= */}
        <div className="payBox">
          <h3 className="sectionTitle">💳 Payment Method</h3>

          <label className="payOption">
            <input
              type="radio"
              checked={payMethod === "UPI"}
              onChange={() => setPayMethod("UPI")}
            />
            <span>UPI / GPay / PhonePe</span>
          </label>

          {payMethod === "UPI" && (
            <input
              className="textInput"
              placeholder="Enter UPI ID"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
          )}

          <label className="payOption">
            <input
              type="radio"
              checked={payMethod === "Card"}
              onChange={() => setPayMethod("Card")}
            />
            <span>Debit / Credit Card</span>
          </label>

          {payMethod === "Card" && (
            <div className="cardBox">
              <input
                className="textInput"
                placeholder="Card Number"
                value={card.number}
                onChange={(e) =>
                  setCard({ ...card, number: e.target.value })
                }
              />
              <div className="cardRow">
                <input
                  className="textInput"
                  placeholder="MM/YY"
                  value={card.expiry}
                  onChange={(e) =>
                    setCard({ ...card, expiry: e.target.value })
                  }
                />
                <input
                  className="textInput"
                  placeholder="CVV"
                  value={card.cvv}
                  onChange={(e) =>
                    setCard({ ...card, cvv: e.target.value })
                  }
                />
              </div>
              <input
                className="textInput"
                placeholder="Bank Name (optional)"
                value={card.bank}
                onChange={(e) =>
                  setCard({ ...card, bank: e.target.value })
                }
              />
            </div>
          )}

          <label className="payOption">
            <input
              type="radio"
              checked={payMethod === "Wallet"}
              onChange={() => setPayMethod("Wallet")}
            />
            <span>Wallet</span>
          </label>

          {payMethod === "Wallet" && (
            <div className="walletBox">
              <div className="walletBalance">
                <span>Available Balance:</span>
                <span className="balance">₹{walletBalance.toFixed(2)}</span>
              </div>
              {walletBalance < summary.total && (
                <div className="walletWarning">
                  ⚠️ Insufficient balance. Please add funds or choose another payment method.
                </div>
              )}
            </div>
          )}

          <label className="payOption">
            <input
              type="radio"
              checked={payMethod === "COD"}
              onChange={() => setPayMethod("COD")}
            />
            <span>Cash on Delivery</span>
          </label>
        </div>

        {/* ================= RIGHT ================= */}
        <div className="summary">
          <h3 className="sectionTitle">🧾 Order Summary</h3>

          <div className="summaryRow strikethrough">
            <span>Original Price</span>
            <span>₹{originalPriceTotal.toFixed(2)}</span>
          </div>

          <div className="summaryRow">
            <span>Discount Price</span>
            <span>₹{summary.subtotal.toFixed(2)}</span>
          </div>

          {discountAmount > 0 && (
            <div className="summaryRow discountSaved">
              <span>Discount Saved</span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="summaryRow">
            <span>Shipping</span>
            <span>₹{summary.shipping.toFixed(2)}</span>
          </div>

          <div className="summaryRow">
            <span>Tax</span>
            <span>₹{summary.tax.toFixed(2)}</span>
          </div>

          {discount > 0 && (
            <div className="summaryRow discount">
              <span>
                Coupon ({appliedCoupon})
                <button onClick={removeCoupon}>❌</button>
              </span>
              <span>-₹{discount.toFixed(2)}</span>
            </div>
          )}

          <div className="summaryRow totalRow">
            <span>Total</span>
            <span>₹{summary.total.toFixed(2)}</span>
          </div>

          {/* COUPON */}
          {!appliedCoupon && (
            <div>
              {/* SUGGESTED COUPONS */}
              {suggestedCoupons.length > 0 && (
                <div className="suggestedCouponsBox">
                  <h4 className="suggestedCouponsLabel">
                    💳 Coupons - Suggested for you
                  </h4>
                  <div className="couponsList">
                    {suggestedCoupons.map((c, idx) => (
                      <button
                        key={idx}
                        className="couponCard"
                        onClick={() =>
                          applySuggestedCoupon(c.code)
                        }
                      >
                        <div className="couponCode">{c.code}</div>
                        <div className="couponDiscount">
                              {c.discount_percent && c.discount_percent > 0
                                ? `-${c.discount_percent}%`
                                : `-₹${(c.discount_amount||0).toFixed(2)}`}
                            </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="couponBox">
                <label className="couponLabel">
                  Enter coupon code
                </label>
                <div className="couponInputGroup">
                  <input
                    className="textInput"
                    placeholder="Enter coupon code"
                    value={coupon}
                    onChange={(e) =>
                      setCoupon(e.target.value)
                    }
                  />
                  <button
                    className="btnOutline"
                    onClick={applyCoupon}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          <button className="btn primary" onClick={handlePayNow}>
            ✅ Pay Now
          </button>
        </div>
      </div>
    </div>
  );
}
