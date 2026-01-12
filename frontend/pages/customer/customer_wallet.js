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

export default function CustomerWalletPage() {
  const router = useRouter();

  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ======================
     AUTH + LOAD WALLET
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/");
      return;
    }
    loadWallet();
  }, [router]);

  async function loadWallet() {
    setError("");
    const res = await apiFetch("/api/accounts/wallet/");
    if (res.ok) {
      setWallet(res.data);
    } else {
      setError("Failed to load wallet");
    }
  }

  /* ======================
     TOP-UP WALLET
  ====================== */
  const addMoney = async () => {
    setError("");
    setSuccess("");

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setLoading(true);

    const res = await apiFetch("/api/accounts/wallet/topup/", {
      method: "POST",
      body: { amount: amt },
    });

    setLoading(false);

    if (res.ok) {
      setAmount("");
      setWallet(res.data);
      setSuccess("✅ Wallet topped up successfully");
    } else {
      setError("❌ Failed to add money");
    }
  };

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      <CustomerNavbar active="wallet" />

      <div className="walletPage">
        <div className="walletContainer">
          {/* Header Section */}
          <div className="walletHeader">
            <h2>👛 My Wallet</h2>
            <p className="subtitle">Manage your account balance and view transactions</p>
          </div>

          {/* Messages */}
          {error && <div className="errorText">{error}</div>}
          {success && <div className="successText">{success}</div>}

          {/* Main Balance Card */}
          <div className="balanceCard">
            <div className="balanceContent">
              <div className="balanceLabel">Current Balance</div>
              <div className="balanceAmount">
                {wallet ? formatINR(wallet?.balance_inr) : "₹0.00"}
              </div>
              <div className="balanceInfo">
                {wallet?.transactions?.length || 0} transactions recorded
              </div>
            </div>

            {/* Top-up Section */}
            <div className="topupSection">
              <div className="topupLabel">Add Money</div>
              <div className="topupForm">
                <input
                  type="number"
                  min="1"
                  placeholder="Enter amount (₹)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="topupInput"
                />
                <button 
                  onClick={addMoney} 
                  disabled={loading}
                  className="topupBtn"
                >
                  {loading ? "Processing..." : "Add Money"}
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Section */}
          <div className="transactionsSection">
            <div className="sectionHeader">
              <h3>📄 Transaction History</h3>
              <span className="txnCount">
                {wallet?.transactions?.length || 0} transactions
              </span>
            </div>

            {wallet?.transactions?.length ? (
              <div className="txnGrid">
                {wallet.transactions.map((t, idx) => (
                  <div key={idx} className={`txnCard txn-${t.txn_type}`}>
                    <div className="txnIcon">
                      {t.txn_type === "credit" ? "💳" : "💸"}
                    </div>
                    <div className="txnBody">
                      <div className="txnDesc">{t.description}</div>
                      <div className="txnDate">
                        {new Date(t.created_at).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className={`txnAmount txn-${t.txn_type}`}>
                      <span className="txnSign">
                        {t.txn_type === "credit" ? "+" : "-"}
                      </span>
                      {formatINR(t.amount_inr)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState">
                <div className="emptyIcon">💰</div>
                <div className="emptyTitle">No Transactions Yet</div>
                <p>Add money to your wallet to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
