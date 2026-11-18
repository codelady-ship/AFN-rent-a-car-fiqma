export type Car = {
  id: string;
  model: string;
  brand: string;
  year: number;
  category: string;
  fuelType: string;
  transmission: string;
  engine: string;
  seats: number;
  color?: string;
  pricePerDay: number;
  available: boolean;
  image: string;
  description?: string;
  featured?: boolean;
  rating?: { average: number; count: number };
};

export type Category = { id: string; name: string };
export type Location = { id: string; name: string; address?: string; type: "office" | "airport" | "delivery"; deliveryFee: number; hours?: string; active?: boolean };
export type Extra = { key: string; name: string; pricePerDay: number; description: string };
export type ExtraLine = { key: string; name: string; pricePerDay: number; total: number };

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export type Quote = {
  days: number;
  pricePerDay: number;
  carTotal: number;
  extras: ExtraLine[];
  extrasTotal: number;
  deliveryFee: number;
  total: number;
  place: string;
};

export type Booking = Quote & {
  id: string;
  reference: string;
  car: string;
  carModel: string;
  from: string;
  to: string;
  name: string;
  phone: string;
  email?: string;
  note?: string;
  status: BookingStatus;
  createdAt?: string;
};

export type Review = { id: string; authorName: string; rating: number; comment: string; createdAt?: string; car?: { model?: string } | string };

export type Message = { id: string; name: string; email: string; phone?: string; subject?: string; message: string; status: "new" | "read" | "archived"; createdAt?: string };

export type User = { id: string; name: string; email: string; phone?: string; role: "customer" | "admin" | "demo" };
export type Session = { token: string; user: User };

export type CarFilters = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  seats?: number;
  transmission?: string;
  fuel?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
};

export type BookingInput = {
  car: string;
  from: string;
  to: string;
  extras: string[];
  location?: string;
  name: string;
  phone: string;
  email?: string;
  note?: string;
};

export type Stats = {
  cars: number;
  customers: number;
  newMessages: number;
  bookings: Record<BookingStatus, number>;
  revenue: number;
  bookedDays: number;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: { field: string; message: string }[] = []
  ) {
    super(message);
  }
  fieldMessage(field: string) {
    return this.details.find((d) => d.field === field)?.message;
  }
}

/** Admin pages are open to the real admin and to the public read-only demo admin ("demo"). */
export const canAdmin = (u?: User | null) => u?.role === "admin" || u?.role === "demo";
