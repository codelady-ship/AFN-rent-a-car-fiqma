// The offline demo follows the same booking rules as the API.
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ADMIN, demo } from "./demo";
import { addDays, todayInBaku } from "./shared";

const day = (n: number) => addDays(todayInBaku(), n);

describe("demo backend", () => {
  beforeEach(() => demo.reset());

  it("filters the fleet like the API", async () => {
    expect(await demo.cars()).toHaveLength(13);
    const eco = await demo.cars({ category: "Ekonom" });
    expect(eco.every((c) => c.category === "Ekonom")).toBe(true);
    const cheap = await demo.cars({ maxPrice: 50, sort: "-price" });
    expect(cheap[0].pricePerDay).toBeLessThanOrEqual(50);
  });

  it("prices on its own, refuses overlaps, allows back-to-back", async () => {
    const [car] = await demo.cars({ category: "Biznes" });
    const q = await demo.quote({ car: car.id, from: day(2), to: day(5), extras: ["gps", "gps"], location: "loc-2" });
    expect(q.total).toBe(3 * car.pricePerDay + 3 * 5 + 20);
    await demo.book({ car: car.id, from: day(2), to: day(5), extras: [], name: "Test Müştəri", phone: "+994 50 000 00 00" });
    await expect(demo.book({ car: car.id, from: day(4), to: day(6), extras: [], name: "Test Müştəri", phone: "+994 50 000 00 00" })).rejects.toMatchObject({ status: 409 });
    await expect(demo.book({ car: car.id, from: day(5), to: day(6), extras: [], name: "Test Müştəri", phone: "+994 50 000 00 00" })).resolves.toMatchObject({ days: 1 });
    await expect(demo.quote({ car: car.id, from: day(5), to: day(5), extras: [] })).rejects.toMatchObject({ status: 400 });
    await expect(demo.quote({ car: car.id, from: day(-1), to: day(2), extras: [] })).rejects.toMatchObject({ status: 400 });
  });

  it("customers see and cancel only their own bookings; admin moves the status on", async () => {
    const a = await demo.register("Aysel Məmmədova", "a@demo.az", "parol12345");
    const b = await demo.register("Bəhruz Əliyev", "b@demo.az", "parol12345");
    const [car] = await demo.cars({ category: "Ekonom" });
    const made = await demo.book({ car: car.id, from: day(3), to: day(4), extras: [], name: "Aysel Məmmədova", phone: "+994 50 000 00 00" }, a.token);
    expect(await demo.mine(a.token)).toHaveLength(1);
    expect(await demo.mine(b.token)).toHaveLength(0);
    await expect(demo.cancel(b.token, made.id)).rejects.toMatchObject({ status: 404 });
    const admin = await demo.login(DEMO_ADMIN.email, DEMO_ADMIN.password);
    await expect(demo.stats(a.token)).rejects.toMatchObject({ status: 403 });
    await expect(demo.setStatus(admin.token, made.id, "completed")).rejects.toMatchObject({ status: 409 });
    expect((await demo.setStatus(admin.token, made.id, "confirmed")).status).toBe("confirmed");
    expect((await demo.cancel(a.token, made.id)).status).toBe("cancelled");
  });
});
