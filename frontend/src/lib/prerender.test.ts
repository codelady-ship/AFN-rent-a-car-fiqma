// Every car link on /park must have a prerendered file, or GitHub Pages answers it with HTTP 404.
import { describe, expect, it } from "vitest";
import { demo } from "./demo";
import { demoCarPath, pageFile } from "./prerender";
import { seedData } from "./shared";

describe("prerendered car pages", () => {
  it("cover every car link of the demo fleet", async () => {
    demo.reset();
    const built = new Set(seedData.cars.map((c) => pageFile(demoCarPath(c.id))));
    const cars = await demo.cars();
    expect(cars.length).toBe(seedData.cars.length);
    for (const car of cars) {
      const link = `/park/${car.id}`; // as CarCard and AfnStory build it
      expect(built.has(pageFile(link)), link).toBe(true);
    }
  });

  it("are named after the demo ids, not the bare seed ids", () => {
    expect(pageFile(demoCarPath(1))).toBe("park/demo-1.html");
  });
});
