"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminAutomationCenterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [config, setConfig] = useState({
    global_enabled: true,
    features: {},
    last_cached: {},
  });

  /* =========================
     LOAD CONFIG
  ========================= */
  const loadConfig = async () => {
    if (!localStorage.getItem("access")) {
      router.replace("/login/admin_login");
      return;
    }

    setLoading(true);
    setMessage("");

    const res = await apiFetch("/api/ml/automation/status/");
    if (!res.ok) {
      setMessage("❌ Failed to load automation status");
      setLoading(false);
      return;
    }

    /* ✅ NORMALIZE */
    const d = res.data || {};

    setConfig({
      global_enabled: Boolean(d.global_enabled),
      features: d.features || {},
      last_cached: d.last_cached || {},
    });

    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  /* =========================
     SAVE CONFIG
  ========================= */
  const saveChanges = async () => {
    setSaving(true);
    setMessage("");

    const res = await apiFetch("/api/ml/automation/update/", {
      method: "PATCH",
      body: {
        global_enabled: config.global_enabled,
        features: config.features,
      },
    });

    if (!res.ok) {
      setMessage("❌ Failed to save automation settings");
      setSaving(false);
      return;
    }

    setMessage("✅ Automation settings saved");
    setSaving(false);
    loadConfig(); // reload canonical state
  };

  /* =========================
     REFRESH CACHE
  ========================= */
  const refreshCache = async (feature = null) => {
    setSaving(true);
    setMessage("");

    const res = await apiFetch("/api/ml/automation/refresh_cache/", {
      method: "POST",
      body: { feature },
    });

    if (!res.ok) {
      setMessage("❌ Cache refresh failed");
      setSaving(false);
      return;
    }

    setMessage(
      feature
        ? `✅ ${feature.replace(/_/g, " ")} cache refreshed`
        : "✅ All caches refreshed"
    );

    setSaving(false);
    loadConfig();
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_automation_center" />

      <main className="main">
        <h1 className="pageTitle">Automation Center</h1>
        <p className="pageSubtitle">
          Control all ML models & automation pipelines
        </p>

        {/* TOP ACTION BUTTONS */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <button className="btn ghost" onClick={loadConfig} disabled={saving}>
            Refresh
          </button>

          <button
            className="btn primary"
            onClick={() => refreshCache(null)}
            disabled={saving}
          >
            Refresh All Caches
          </button>

          <button
            className="btn primary"
            onClick={saveChanges}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {message && <div className="automation-note">{message}</div>}

        {loading ? (
          <div>Loading automation settings…</div>
        ) : (
          <>
            {/* GLOBAL AUTOMATION - EXPANDED FULL WIDTH */}
            <div className="card" style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Global Automation</h3>
                  <p className="automation-note">
                    When OFF, all ML outputs use cached values only.
                  </p>
                  {!config.global_enabled && (
                    <div className="automation-note danger">
                      ⚠ Global automation is OFF — all live ML is disabled
                    </div>
                  )}
                </div>

                <div className="toggleButtons" style={{ flexShrink: 0 }}>
                  <button
                    className={`btn ${
                      config.global_enabled ? "primary" : "ghost"
                    }`}
                    onClick={() =>
                      setConfig((p) => ({ ...p, global_enabled: true }))
                    }
                  >
                    ON
                  </button>

                  <button
                    className={`btn ${
                      !config.global_enabled ? "danger" : "ghost"
                    }`}
                    onClick={() =>
                      setConfig((p) => ({ ...p, global_enabled: false }))
                    }
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>

            {/* FEATURES */}
            <div className="card">
              <h3>Automation Modules</h3>

              {Object.keys(config.features).length === 0 && (
                <p className="muted">No automation modules registered</p>
              )}

              {Object.keys(config.features).map((feature) => {
                const isActive = Boolean(config.features[feature]);

                return (
                  <div key={feature} className="featureRow">
                    <div>
                      <strong>
                        {feature.replace(/_/g, " ").toUpperCase()}
                      </strong>
                      <div className="automation-note">
                        Status:{" "}
                        <b className={isActive ? "success" : "danger"}>
                          {isActive ? "ON" : "OFF"}
                        </b>
                        <br />
                        Last cached:{" "}
                        {config.last_cached?.[feature] || "Never"}
                      </div>
                    </div>

                    <div className="featureActions">
                      <button
                        className="btn ghost"
                        onClick={() => refreshCache(feature)}
                        disabled={saving}
                      >
                        Refresh Cache
                      </button>

                      <div className="toggleButtons">
                        <button
                          className={`btn ${
                            isActive ? "primary" : "ghost"
                          }`}
                          onClick={() =>
                            setConfig((p) => ({
                              ...p,
                              features: {
                                ...p.features,
                                [feature]: true,
                              },
                            }))
                          }
                        >
                          ON
                        </button>

                        <button
                          className={`btn ${
                            !isActive ? "danger" : "ghost"
                          }`}
                          onClick={() =>
                            setConfig((p) => ({
                              ...p,
                              features: {
                                ...p.features,
                                [feature]: false,
                              },
                            }))
                          }
                        >
                          OFF
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
