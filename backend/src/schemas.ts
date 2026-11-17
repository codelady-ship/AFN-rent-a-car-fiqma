import { z } from "zod";
import { BOOKING_STATUSES, CATEGORIES, EXTRA_KEYS } from "./catalog";
import { isIsoDay } from "./lib/dates";

export const isoDay = z.string().trim().refine(isIsoDay, "Tarixi YYYY-MM-DD formatında yazın.");
const phone = z.string().trim().regex(/^[+]?[0-9 ()-]{9,20}$/, "Telefon nömrəsini düzgün yazın.");
const email = z.string().trim().toLowerCase().email("E-poçtu düzgün yazın.").max(120);
const password = z.string().min(8, "Şifrə ən azı 8 simvol olmalıdır.").max(72);

export const registerSchema = z.object({
  name: z.string().trim().min(3, "Ad və soyadı yazın (ən azı 3 hərf).").max(80),
  email,
  phone: phone.optional().or(z.literal("")),
  password,
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(72) });

export const carSchema = z.object({
  model: z.string().trim().min(2).max(80),
  brand: z.string().trim().min(2).max(40),
  year: z.coerce.number().int().min(1990).max(2100),
  category: z.enum(CATEGORIES),
  fuelType: z.string().trim().min(2).max(30),
  transmission: z.string().trim().min(2).max(30),
  engine: z.string().trim().min(1).max(10),
  seats: z.coerce.number().int().min(1).max(60),
  color: z.string().trim().max(30).optional(),
  pricePerDay: z.coerce.number().positive().max(10000),
  available: z.boolean().optional(),
  image: z.string().trim().min(1).max(300),
  description: z.string().trim().max(1000).optional(),
  featured: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
});

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
export const carQuerySchema = z
  .object({
    category: z.string().trim().max(40).optional(),
    available: bool.optional(),
    featured: bool.optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    seats: z.coerce.number().int().min(1).max(60).optional(),
    transmission: z.string().trim().max(30).optional(),
    fuel: z.string().trim().max(30).optional(),
    q: z.string().trim().max(60).optional(),
    from: isoDay.optional(),
    to: isoDay.optional(),
    sort: z.enum(["price", "-price", "year", "-year"]).optional(),
  })
  .refine((v) => !v.from === !v.to, { path: ["to"], message: "from və to birlikdə göndərilməlidir." })
  .refine((v) => !v.from || !v.to || v.from < v.to, { path: ["to"], message: "to tarixi from tarixindən sonra olmalıdır." });

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(160).optional(),
  type: z.enum(["office", "airport", "delivery"]),
  deliveryFee: z.coerce.number().min(0).max(1000).optional(),
  hours: z.string().trim().max(60).optional(),
  active: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
});

const quoteFields = {
  car: z.string().trim().min(1, "Avtomobil seçin."),
  from: isoDay,
  to: isoDay,
  extras: z.array(z.enum(EXTRA_KEYS)).max(EXTRA_KEYS.length).optional().default([]),
  location: z.string().trim().max(40).optional(),
  place: z.string().trim().max(80).optional(),
};
export const quoteSchema = z.object(quoteFields);

export const bookingSchema = z.object({
  ...quoteFields,
  name: z.string().trim().min(3, "Ad və soyadı yazın (ən azı 3 hərf).").max(80),
  phone,
  email: email.optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().default(""),
});

export const statusSchema = z.object({ status: z.enum(BOOKING_STATUSES) });

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});

export const messageSchema = z.object({
  name: z.string().trim().min(2, "Adınızı yazın.").max(80),
  email,
  phone: phone.optional().or(z.literal("")),
  subject: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(10, "Mesaj ən azı 10 simvol olmalıdır.").max(2000),
  // Honeypot: real people leave it empty.
  website: z.string().max(0).optional(),
});
export const messageStatusSchema = z.object({ status: z.enum(["new", "read", "archived"]) });
