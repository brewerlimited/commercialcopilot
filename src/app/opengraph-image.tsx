import { ImageResponse } from "next/og";

export const alt = "Commercial Co-Pilot dashboard preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f8fbff",
          color: "#0f172a",
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: 54,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            borderRadius: 38,
            border: "1px solid rgba(15, 23, 42, 0.10)",
            background: "linear-gradient(135deg, #ffffff 0%, #f0f8ff 44%, #effcf6 100%)",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "46%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "48px 34px 48px 48px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 18,
                  background: "#0f172a",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    border: "8px solid #ffffff",
                    borderTopColor: "transparent",
                    borderBottomColor: "transparent",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 27, fontWeight: 900 }}>Commercial Co-Pilot</div>
                <div style={{ marginTop: 4, color: "#b45309", fontSize: 17, fontWeight: 800 }}>Built for subcontractors</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ color: "#2563a8", fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
                Commercial recovery software
              </div>
              <div style={{ fontSize: 58, lineHeight: 0.98, fontWeight: 900, letterSpacing: -2 }}>
                Stronger CEs. More recovery followed through.
              </div>
              <div style={{ color: "#596579", fontSize: 24, lineHeight: 1.35, fontWeight: 600 }}>
                Track EWNs, build CE / VO packs, support entitlement and manage payment recovery.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["NEC", "JCT", "EWNs", "CEs / VOs", "Payment tracking"].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    borderRadius: 999,
                    border: "1px solid rgba(37, 99, 168, 0.18)",
                    background: "rgba(255, 255, 255, 0.72)",
                    color: "#334155",
                    padding: "10px 13px",
                    fontSize: 16,
                    fontWeight: 800,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              width: "54%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "46px 42px 46px 12px",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "82%",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                borderRadius: 28,
                border: "1px solid rgba(15, 23, 42, 0.10)",
                background: "#ffffff",
                padding: 26,
                boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ color: "#596579", fontSize: 14, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
                    Recovery control panel
                  </div>
                  <div style={{ maxWidth: 390, fontSize: 30, lineHeight: 1.08, fontWeight: 900 }}>
                    See what value is live, stuck and ready to recover.
                  </div>
                </div>
                <div style={{ borderRadius: 14, border: "1px solid rgba(15, 23, 42, 0.10)", padding: "10px 13px", color: "#596579", fontSize: 14, fontWeight: 800 }}>
                  All Projects
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                {[
                  ["Recoverable", "£40,815", "#f0f8ff", "#2563a8"],
                  ["Awaiting payment", "£20,212", "#fff5ef", "#b45309"],
                  ["Recovered", "£4,580", "#effcf6", "#137657"],
                ].map(([label, value, bg, text]) => (
                  <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 18, background: bg, border: "1px solid rgba(15,23,42,0.08)", padding: 18 }}>
                    <div style={{ color: text, fontSize: 13, fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
                    <div style={{ marginTop: 20, fontSize: 31, fontWeight: 900 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Payment overdue", "CE 010 - ST94 steel rehandling", "£4,928", "#fff5ef"],
                  ["Accepted / unpaid", "VAR 002 - Facade bracket clashes", "£7,964", "#f0f8ff"],
                  ["Submitted / unpaid", "CE 001 - Revised drainage run", "£7,320", "#effcf6"],
                ].map(([label, title, value, bg]) => (
                  <div key={title} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 16, background: bg, border: "1px solid rgba(15,23,42,0.08)", padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ color: "#596579", fontSize: 13, fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
