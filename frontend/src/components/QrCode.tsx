import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value }: { value: string }) {
	const [src, setSrc] = useState("");

	useEffect(() => {
		let active = true;
		QRCode.toString(value, {
			type: "svg",
			margin: 2,
			color: { dark: "#3c3c4a", light: "#ffffff" },
		})
			.then(
				(svg) =>
					active &&
					setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`),
			)
			.catch(() => active && setSrc(""));
		return () => {
			active = false;
		};
	}, [value]);

	return src ? (
		<img src={src} className="qr" alt="QR-Code zum Beitreten" />
	) : (
		<div className="qr" />
	);
}
