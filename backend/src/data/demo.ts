// Demo content shared by the seed script and the frontend's offline demo mode (no imports, plain data).

export const LOCATIONS = [
  { name: "Ofis – Xocalı pr. 13", address: "Bakı, Xocalı prospekti 13", type: "office", deliveryFee: 0, hours: "Hər gün 09:00–21:00" },
  { name: "Heydər Əliyev Beynəlxalq Hava Limanı", address: "Bakı, Hava limanı, gəliş zalı", type: "airport", deliveryFee: 20, hours: "7/24" },
  { name: "Ünvana çatdırılma (Bakı daxilində)", address: "Bakı şəhəri daxilində istənilən ünvan", type: "delivery", deliveryFee: 15, hours: "09:00–23:00" },
] as const;

export const DESCRIPTIONS: Record<string, string> = {
  Ekonom: "Şəhər daxilində gündəlik sürüş üçün qənaətcil və rahat seçim.",
  Biznes: "Görüşlərə və hava limanı transferlərinə uyğun, geniş və sakit salon.",
  Premium: "Xüsusi günlər və uzun yollar üçün yüksək komfort və güc.",
  "Krossover və SUV": "Ailə səfərləri və bölgələr üçün hündür klirens və geniş baqaj.",
  Avtobuslar: "Qrup turları, toylar və korporativ tədbirlər üçün sürücü ilə.",
};

export const FEATURED = ["Toyota Camry", "Hyundai Tucson", "Toyota Land Cruiser Prado"];

/** [car model, author, rating, comment] */
export const REVIEWS: [string, string, number, string][] = [
  ["Toyota Camry", "Elvin M.", 5, "Avtomobil təmiz və tam bak idi, hava limanında vaxtında təhvil verdilər."],
  ["Hyundai Tucson", "Nigar Ə.", 5, "Qəbələ səfəri üçün götürdük, çox rahat idi. Uşaq oturacağı da hazır idi."],
  ["Hyundai Accent", "Rauf H.", 4, "Qiymətinə görə əla seçimdir, şəhərdə yanacağa qənaət edir."],
  ["Toyota Land Cruiser Prado", "Samirə Q.", 5, "Bölgə yolları üçün ideal idi. Menecer bütün suallara cavab verdi."],
];
