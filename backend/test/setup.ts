// Shared test harness: an in-memory MongoDB, the seeded demo data and the Express app.
process.env.JWT_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";
process.env.AUTH_RATE_LIMIT ??= "1000";
process.env.PUBLIC_RATE_LIMIT ??= "1000";

import { MongoMemoryServer } from "mongodb-memory-server-core";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";

export const isoIn = (days: number) => {
  const now = new Date(Date.now() + 4 * 3600 * 1000); // Baku is UTC+4
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString().slice(0, 10);
};

export async function startHarness() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("afn-test"));
  const { seed } = await import("../src/seed");
  const { createApp } = await import("../src/app");
  await seed();
  const app = createApp();
  return {
    app,
    async stop() {
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}

export async function adminToken(app: Express) {
  const res = await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "test-password" });
  return res.body.token as string;
}

let n = 0;
export async function customer(app: Express, name = "Test Müştəri") {
  const email = `user${Date.now()}${n++}@test.local`;
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "parol12345", phone: "+994 50 000 00 00" });
  return { token: res.body.token as string, user: res.body.user, email };
}
