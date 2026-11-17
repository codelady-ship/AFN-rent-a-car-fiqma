import { EXTRAS } from "../lib/shared";

/** Visible on the landing page and repeated as FAQPage JSON-LD (keep them identical). */
export const FAQ: [string, string][] = [
  ["Qiymət necə hesablanır?", "Gündəlik qiymət gün sayına vurulur, üstünə seçdiyiniz əlavələr və çatdırılma gəlir. Qaytarma günü hesablanmır: məsələn, 20-dən 23-ə qədər icarə 3 gündür. Qiyməti server hesablayır və rezervasiya formasında dərhal görürsünüz."],
  ["Avtomobili harada götürə bilərəm?", "Xocalı prospekti 13-dəki ofisdə (pulsuz), Heydər Əliyev Beynəlxalq Hava Limanında (+20 AZN) və ya Bakı daxilində istədiyiniz ünvana çatdırılma ilə (+15 AZN)."],
  ["Ödəniş nə vaxt edilir?", "Onlayn sorğudan sonra menecer rezervasiyanı telefonla təsdiqləyir. Ödəniş avtomobil sizə təhvil veriləndə edilir."],
  ["Hansı əlavələri götürə bilərəm?", EXTRAS.map((e) => `${e.name} – ${e.pricePerDay} AZN/gün`).join(", ") + "."],
  ["Rezervasiyanı necə ləğv edim?", "Hesabınıza daxil olub “Rezervasiyalarım” bölməsində götürmə günündən əvvəl bir kliklə ləğv edə bilərsiniz. Qonaq kimi göndərdiyiniz sorğular üçün bizə zəng edin."],
  ["Ən uzun icarə müddəti nə qədərdir?", "Onlayn ən çox 60 günlük rezervasiya etmək olar. Daha uzun müddət və korporativ sifarişlər üçün bizə yazın."],
];
