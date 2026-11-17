// Fixed lists shared by models, validation and pricing.
export const CATEGORIES = ["Ekonom", "Biznes", "Premium", "Krossover və SUV", "Avtobuslar"] as const;
export type Category = (typeof CATEGORIES)[number];

export const TRANSMISSIONS = ["Avtomatik", "Mexaniki"] as const;
export const FUELS = ["Benzin", "Dizel", "Hibrid", "Elektrik"] as const;

/** "Your trip kit": optional extras priced per day (AZN). Prices are computed only on the server. */
export const EXTRAS = [
  { key: "child-seat", name: "Uşaq oturacağı", pricePerDay: 8, description: "0–12 yaş üçün sertifikatlı oturacaq" },
  { key: "gps", name: "GPS naviqator", pricePerDay: 5, description: "Azərbaycan xəritəsi yüklənmiş" },
  { key: "extra-driver", name: "Əlavə sürücü", pricePerDay: 10, description: "İkinci sürücü sığortaya daxil edilir" },
  { key: "full-insurance", name: "Tam sığorta (KASKO)", pricePerDay: 20, description: "Franşizasız tam qoruma" },
  { key: "wifi", name: "Mobil Wi-Fi", pricePerDay: 6, description: "4G modem, limitsiz trafik" },
  { key: "roof-box", name: "Dam baqajı", pricePerDay: 12, description: "Səyahət üçün əlavə 400 litr yer" },
] as const;
export type ExtraKey = (typeof EXTRAS)[number]["key"];
export const EXTRA_KEYS = EXTRAS.map((e) => e.key) as [ExtraKey, ...ExtraKey[]];

export const BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Allowed status changes: pending → confirmed → completed, and cancel from pending or confirmed. */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const MAX_RENTAL_DAYS = 60;
