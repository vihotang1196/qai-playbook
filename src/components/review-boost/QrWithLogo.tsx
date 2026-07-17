import { QRCodeSVG } from "qrcode.react";

type Props = {
  value: string;
  size?: number;
  logoUrl?: string | null;
  /** Logo size as a fraction of the QR (≤0.25 keeps it scannable at level H). */
  logoRatio?: number;
};

/**
 * QR code with an optional centered logo overlay. Error-correction level "H"
 * (~30% recoverable) so a logo up to ~25% of the QR doesn't break scanning.
 */
export default function QrWithLogo({ value, size = 200, logoUrl, logoRatio = 0.22 }: Props) {
  const logoSize = Math.round(size * logoRatio);
  const padding = Math.max(4, Math.round(logoSize * 0.18));
  const wrap = logoSize + padding * 2;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <QRCodeSVG value={value} size={size} level="H" fgColor="#111111" bgColor="#ffffff" />
      {logoUrl ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: wrap,
            height: wrap,
            background: "#ffffff",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ width: logoSize, height: logoSize, objectFit: "contain", display: "block" }} />
        </div>
      ) : null}
    </div>
  );
}
