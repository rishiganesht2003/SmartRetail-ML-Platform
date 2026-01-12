// frontend/pages/index.js
"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="home-body">
      <ThemeToggle />

      <h1 className="home-heading">
        Smart Retail. <span>Smarter Insights.</span>
      </h1>

      <p className="home-subtitle">
        AI-powered predictive retail analytics platform for smarter decisions
      </p>

      <div className="home-card-container">
        <div className="home-card customer">
          <div className="home-icon">🛍️</div>
          <h3>Customer Login</h3>
          <p>Shop with AI-powered recommendations and smart pricing</p>
          <Link href="/login/customer_login" className="home-btn home-btn1">
            Enter Store
          </Link>
        </div>

        <div className="home-card admin">
          <div className="home-icon">🧠</div>
          <h3>Admin Login</h3>
          <p>Advanced analytics, ML insights, and full control</p>
          <Link href="/login/admin_login" className="home-btn home-btn3">
            Analytics Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
