"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetailsNavbar from "@/components/navigation/customer/ProductDetailsNavbar";

export default function CustomerReviewOrderPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState([]);
  const [address, setAddress] = useState(null);
  const [summary, setSummary] = useState({
    subtotal: 0,
    shipping: 10,
    tax: 0,
    total: 0,
  });

  /* ======================
     AUTH + HYDRATION
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/");
      return;
    }
    setMounted(true);
  }, [router]);

  /* ======================
     LOAD ADDRESS
  ====================== */
  useEffect(() => {
    if (!mounted) return;

    const addr = JSON.parse(
      localStorage.getItem("selectedAddress")
    );

    if (!addr) {
      router.replace("/customer/customer_saved_addresses");
      return;
    }

    setAddress(addr);
  }, [mounted, router]);

  /* ======================
     LOAD CART + CALCULATE
  ====================== */
  useEffect(() => {
    if (!mounted) return;

    const storedCart =
      JSON.parse(localStorage.getItem("cart")) || [];

    if (storedCart.length === 0) {
      router.replace("/customer/customer_cart");
      return;
    }

    setCart(storedCart);

    let subtotal = 0;
    let totalItems = 0;
    storedCart.forEach((item) => {
      subtotal += Number(item.price) * Number(item.qty);
      totalItems += Number(item.qty);
    });

    const shippingPerItem = 10;
    const shipping = shippingPerItem * totalItems; // ₹10 per item
    const tax = +(subtotal * 0.05).toFixed(2);
    const total = subtotal + shipping + tax;

    setSummary({ subtotal, shipping, tax, total });
  }, [mounted, router]);

  /* ======================
     CONTINUE → PAYMENT
  ====================== */
  const continueToPayment = () => {
    document.getElementById("loader").style.display = "flex";

    localStorage.setItem(
      "tempOrder",
      JSON.stringify({
        address,
        items: cart,
        pricing: summary,
      })
    );

    setTimeout(() => {
      router.push("/customer/customer_payment");
    }, 500);
  };

  /* ======================
     SAFE RENDER
  ====================== */
  if (!mounted || !address || cart.length === 0) {
    return <div className="page">Loading order details…</div>;
  }

  return (
    <div className="root">
      <ProductDetailsNavbar />

      {/* Loader */}
      <div id="loader" className="loader">
        Processing…
      </div>

      <div className="page reviewPage">
        {/* ADDRESS */}
        <div className="box">
          <div className="boxTitle">📍 Delivery Address</div>
          <div>{address.name}</div>
          <div>
            {address.address_line}, {address.city} –{" "}
            {address.pincode}
          </div>
          <div>📞 {address.phone}</div>
        </div>

        {/* PAYMENT */}
        <div className="box">
          <div className="boxTitle">💳 Payment Method</div>
          <div>Choose in next step</div>
        </div>

        {/* ITEMS */}
        <div className="box">
          <div className="boxTitle">🛒 Items</div>

          {cart.map((item, idx) => {
            // Calculate original price (assuming 20% discount for dynamic pricing)
            const originalPrice = item.basePrice || (item.price / 0.8);
            const savingsPercent = item.basePrice 
              ? Math.round(((item.basePrice - item.price) / item.basePrice) * 100)
              : 20;

            return (
              <div key={idx} className="reviewItem">
                <img
                  src={item.image || "/placeholder.png"}
                  alt={item.name}
                  className="reviewItemImage"
                />
                <div className="reviewItemDetails">
                  <div className="itemName">{item.name}</div>
                  
                  {/* Price Section */}
                  <div className="priceSection">
                    <div className="priceRow">
                      <span className="label">Original Price:</span>
                      <span className="originalPrice">₹{originalPrice.toFixed(2)}</span>
                    </div>
                    <div className="priceRow">
                      <span className="label">Discount Price:</span>
                      <div className="dynamicPriceContainer">
                        <span className="dynamicPrice">₹{item.price}</span>
                        <span className="savingsTag">{savingsPercent}% OFF</span>
                      </div>
                    </div>
                    <div className="priceRow">
                      <span className="label">Quantity:</span>
                      <span>{item.qty}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SUMMARY */}
        <div className="box">
          <div className="boxTitle">🧾 Order Summary</div>

          <div className="summaryGrid">
            <div className="summarySection">
              <div className="row">
                <span>Subtotal</span>
                <span className="amount">₹{summary.subtotal.toFixed(2)}</span>
              </div>

              <div className="row">
                <span>Shipping</span>
                <span className="amount">₹{summary.shipping.toFixed(2)}</span>
              </div>

              <div className="row">
                <span>Tax (5%)</span>
                <span className="amount">₹{summary.tax.toFixed(2)}</span>
              </div>
            </div>

            <div className="summarySection highlight">
              <div className="row total">
                <span className="totalLabel">Total Amount</span>
                <span className="totalAmount">₹{summary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <button className="continueBtn btn primary" onClick={continueToPayment}>
          Continue to Payment →
        </button>
      </div>
    </div>
  );
}
