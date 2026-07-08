import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders `value` as a QR code image. Uses the already-installed `qrcode`
// package to produce a data URL.
export function QrCode({
	value,
	size = 200,
}: {
	value: string;
	size?: number;
}) {
	const [src, setSrc] = useState("");

	useEffect(() => {
		let active = true;
		QRCode.toDataURL(value, { width: size, margin: 1 })
			.then((url) => active && setSrc(url))
			.catch(() => active && setSrc(""));
		return () => {
			active = false;
		};
	}, [value, size]);

	if (!src) return null;
	return (
		<img
			src={src}
			width={size}
			height={size}
			alt="QR-Code zum Beitreten"
			className="rounded-lg bg-white p-2"
		/>
	);
}
