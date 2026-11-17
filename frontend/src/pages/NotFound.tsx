import { Link } from "react-router-dom";
import { useMeta } from "../lib/store";

export default function NotFound() {
  useMeta("Səhifə tapılmadı");
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Səhifə tapılmadı</h1>
      <p className="text-muted">Bu ünvanda səhifə yoxdur.</p>
      <Link to="/" className="btn btn-brand mt-4">
        Ana səhifəyə
      </Link>
    </div>
  );
}
